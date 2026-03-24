import type { PrismaClient } from "../db/prisma-client";
import { PredictionEligibility } from "../db/prisma-client";
import { MIN_ODDS_MATCH_SCORE } from "../constants/predictionIntegrity";
import {
  reliabilityFlagsForInsufficientReason,
  validateLiveBookOdds,
  type LiveOddsValidation,
} from "./oddsFixtureValidation";
import { cacheDel } from "../utils/cache";
import { fetchDailyMatches } from "../integrations/footballApi";
import { fetchOdds } from "../integrations/oddsApi";
import type { NormalizedMatch, NormalizedOdds } from "../integrations/types";
import { runPredictionEngine } from "../engines/predictionEngine";
import { resolveEngineWeights } from "../engines/weights";
import { loadEnv } from "../config/env";
import { computeEmpiricalMatchStats } from "./empiricalMatchStats";
import { classifyOddsBand } from "../engines/oddsContext";
import { bandFromRealizedTotalGoals } from "../utils/ouInference";
import {
  getTrackRecordAdjustment,
  NAIVE_BASELINE_1X2,
  settleFinishedMatches,
  TRACK_RECORD_MIN_N,
} from "./predictionSettlement";
import { clamp } from "../utils/math";
import { computeEdgeDetection } from "../engines/edgeDetection";

function oddsForMatch(oddsList: NormalizedOdds[], match: NormalizedMatch, index: number): NormalizedOdds | null {
  const at = oddsList[index];
  if (at && at.matchExternalId === match.externalId) return at;
  const direct = oddsList.find((o) => o.matchExternalId === match.externalId);
  if (direct) return direct;
  return null;
}

async function clearMatchPredictionArtifacts(prisma: PrismaClient, matchId: string): Promise<void> {
  await prisma.prediction.deleteMany({ where: { matchId } });
  await prisma.similarityCase.deleteMany({ where: { matchId } });
  await prisma.odds.deleteMany({ where: { matchId } });
}

export async function ingestAndPredict(prisma: PrismaClient): Promise<{ matches: number; predictions: number }> {
  const env = loadEnv();
  const weights = await resolveEngineWeights(async (key) => {
    const row = await prisma.engineWeight.findUnique({ where: { key } });
    return row?.value ?? null;
  });

  const matchResult = await fetchDailyMatches();
  const normalizedMatches = matchResult.matches;
  const oddsResult = await fetchOdds(normalizedMatches);
  const oddsList = oddsResult.odds;
  /** Engine degradation when demo mode or football feed failed. */
  const footballMocked = Boolean(env.MOCK_DATA_MODE) || matchResult.source === "mock";
  /** Synthetic odds path: no key, or forced mock — predictions are labelled mockContext and excluded from public track record. */
  const allowSyntheticPredictions = footballMocked || !env.ODDS_API_KEY?.trim();
  /** Live-odds path: keys configured but odds API failed entirely — do not emit predictions. */
  const globalOddsFailure = !allowSyntheticPredictions && oddsResult.source === "mock";
  const engineMockData = footballMocked || allowSyntheticPredictions;

  const trackRecord = await getTrackRecordAdjustment(prisma);

  let predCount = 0;

  for (let mi = 0; mi < normalizedMatches.length; mi++) {
    const m = normalizedMatches[mi]!;
    const odds = oddsForMatch(oddsList, m, mi);

    const leagueExt = m.league?.externalId ?? "MOCK_LEAGUE";
    const league = await prisma.league.upsert({
      where: { externalId: leagueExt },
      create: {
        externalId: leagueExt,
        name: m.league?.name ?? "Unknown League",
        country: m.league?.country,
        logoUrl: m.league?.logoUrl,
      },
      update: { name: m.league?.name ?? "Unknown League", country: m.league?.country, logoUrl: m.league?.logoUrl },
    });

    const homeTeam = await prisma.team.upsert({
      where: { externalId: m.home.externalId },
      create: {
        externalId: m.home.externalId,
        name: m.home.name,
        shortName: m.home.shortName,
        leagueId: league.id,
      },
      update: { name: m.home.name, shortName: m.home.shortName, leagueId: league.id },
    });

    const awayTeam = await prisma.team.upsert({
      where: { externalId: m.away.externalId },
      create: {
        externalId: m.away.externalId,
        name: m.away.name,
        shortName: m.away.shortName,
        leagueId: league.id,
      },
      update: { name: m.away.name, shortName: m.away.shortName, leagueId: league.id },
    });

    const matchRow = await prisma.match.upsert({
      where: { externalId: m.externalId },
      create: {
        externalId: m.externalId,
        utcDate: new Date(m.utcDate),
        status: m.status,
        season: m.season,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        leagueId: league.id,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        oddsFetchedAt: new Date(),
      },
      update: {
        utcDate: new Date(m.utcDate),
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        oddsFetchedAt: new Date(),
      },
    });

    if (globalOddsFailure) {
      await clearMatchPredictionArtifacts(prisma, matchRow.id);
      await prisma.match.update({
        where: { id: matchRow.id },
        data: {
          predictionEligibility: PredictionEligibility.INSUFFICIENT_DATA,
          insufficientDataReason: "odds_feed_unavailable",
          reliabilityFlags: reliabilityFlagsForInsufficientReason("odds_feed_unavailable"),
        },
      });
      continue;
    }

    const tripletOk =
      Boolean(odds) &&
      Number.isFinite(odds!.homeOdds) &&
      Number.isFinite(odds!.drawOdds) &&
      Number.isFinite(odds!.awayOdds) &&
      odds!.homeOdds >= 1.01 &&
      odds!.drawOdds >= 1.01 &&
      odds!.awayOdds >= 1.01;

    const baseCanPredict =
      tripletOk &&
      (allowSyntheticPredictions ||
        (odds!.oddsSource === "book_matched" && (odds!.matchQuality ?? 0) >= MIN_ODDS_MATCH_SCORE));

    let liveCheck: LiveOddsValidation = { ok: true };
    if (tripletOk && baseCanPredict && !allowSyntheticPredictions && odds?.oddsSource === "book_matched") {
      liveCheck = validateLiveBookOdds(m, odds, Date.now());
    }

    const canPredict = baseCanPredict && liveCheck.ok;

    if (!tripletOk || !canPredict) {
      await clearMatchPredictionArtifacts(prisma, matchRow.id);
      let reason: string;
      if (!tripletOk) {
        reason = !odds ? "odds_missing" : "odds_invalid";
      } else if (!baseCanPredict) {
        reason = "odds_unmatched_or_low_confidence";
      } else if (!liveCheck.ok) {
        reason = liveCheck.reason;
      } else {
        reason = "odds_unmatched_or_low_confidence";
      }
      await prisma.match.update({
        where: { id: matchRow.id },
        data: {
          predictionEligibility: PredictionEligibility.INSUFFICIENT_DATA,
          insufficientDataReason: reason,
          reliabilityFlags: reliabilityFlagsForInsufficientReason(reason),
        },
      });
      continue;
    }

    const homeOdds = odds!.homeOdds;
    const drawOdds = odds!.drawOdds;
    const awayOdds = odds!.awayOdds;

    await prisma.match.update({
      where: { id: matchRow.id },
      data: {
        predictionEligibility: PredictionEligibility.OK,
        insufficientDataReason: null,
        reliabilityFlags: [],
      },
    });

    await prisma.odds.deleteMany({ where: { matchId: matchRow.id } });
    await prisma.odds.create({
      data: {
        matchId: matchRow.id,
        bookmaker: (() => {
          if (engineMockData) return "mock";
          const b = odds?.bookmaker;
          if (b && b !== "mock") return b;
          return "synthetic";
        })(),
        homeOdds,
        drawOdds,
        awayOdds,
        over25: odds?.over25,
        under25: odds?.under25,
        bttsYes: odds?.bttsYes,
        bttsNo: odds?.bttsNo,
      },
    });

    const stats = await computeEmpiricalMatchStats(prisma, {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      leagueId: league.id,
      matchUtcDate: new Date(m.utcDate),
      excludeMatchId: matchRow.id,
      mockData: engineMockData,
      homeOdds,
      drawOdds,
      awayOdds,
    });

    const {
      homeFormPts,
      awayFormPts,
      homeXG,
      awayXG,
      homeGoalsAgainstAvg: homeGa,
      awayGoalsAgainstAvg: awayGa,
      strengthGap,
      restDaysHome,
      restDaysAway,
      leagueStrengthIndex,
      hasStats: hasStatsFromDb,
      empiricalBlend,
      rolling,
      homeGFPerGame,
      awayGFPerGame,
    } = stats;

    await prisma.matchStats.upsert({
      where: { matchId: matchRow.id },
      create: {
        matchId: matchRow.id,
        homeFormPts,
        awayFormPts,
        homeXG,
        awayXG,
        homeGoalsFor: homeGFPerGame ?? homeXG,
        homeGoalsAgainst: homeGa,
        awayGoalsFor: awayGFPerGame ?? awayXG,
        awayGoalsAgainst: awayGa,
        strengthGap,
      },
      update: {
        homeFormPts,
        awayFormPts,
        homeXG,
        awayXG,
        homeGoalsFor: homeGFPerGame ?? homeXG,
        homeGoalsAgainst: homeGa,
        awayGoalsFor: awayGFPerGame ?? awayXG,
        awayGoalsAgainst: awayGa,
        strengthGap,
      },
    });

    const historical = await prisma.match.findMany({
      where: {
        status: "FT",
        NOT: { id: matchRow.id },
      },
      take: 80,
      orderBy: { utcDate: "desc" },
      include: { odds: { orderBy: { fetchedAt: "desc" }, take: 1 }, stats: true },
    });

    const pool = historical
      .filter((h) => h.odds[0] && h.homeScore != null && h.awayScore != null)
      .map((h) => {
        const o = h.odds[0]!;
        const imp = {
          home: 1 / o.homeOdds,
          draw: 1 / o.drawOdds,
          away: 1 / o.awayOdds,
        };
        const s = imp.home + imp.draw + imp.away;
        const hg = h.homeScore!;
        const ag = h.awayScore!;
        const ih = imp.home / s;
        const id = imp.draw / s;
        const ia = imp.away / s;
        const tg = hg + ag;
        return {
          externalId: h.externalId ?? h.id,
          homeOdds: o.homeOdds,
          drawOdds: o.drawOdds,
          awayOdds: o.awayOdds,
          impliedHome: ih,
          impliedDraw: id,
          impliedAway: ia,
          strengthGap: h.stats?.strengthGap ?? 0,
          homeForm: h.stats?.homeFormPts ?? 1.5,
          awayForm: h.stats?.awayFormPts ?? 1.5,
          oddsBand: classifyOddsBand({ home: ih, draw: id, away: ia }),
          totalBand: bandFromRealizedTotalGoals(tg),
          result1x2: hg > ag ? ("HOME" as const) : ag > hg ? ("AWAY" as const) : ("DRAW" as const),
          totalGoals: tg,
          homeGoals: hg,
          awayGoals: ag,
          btts: hg > 0 && ag > 0,
          over25: hg + ag > 2,
          scoreLabel: `${hg}-${ag}`,
        };
      });

    const prevPred = await prisma.prediction.findFirst({
      where: { matchId: matchRow.id },
      orderBy: { createdAt: "desc" },
    });

    await prisma.prediction.deleteMany({ where: { matchId: matchRow.id } });

    const out = runPredictionEngine({
      homeOdds,
      drawOdds,
      awayOdds,
      homeFormPts,
      awayFormPts,
      homeXG,
      awayXG,
      homeGoalsAgainstAvg: homeGa,
      awayGoalsAgainstAvg: awayGa,
      strengthGap,
      hasStats: hasStatsFromDb,
      mockData: engineMockData,
      weights,
      historicalPool: pool.length >= 8 ? pool : undefined,
      restDaysHome,
      restDaysAway,
      leagueStrengthIndex,
      rolling,
      empiricalBlend,
      over25: odds?.over25,
      under25: odds?.under25,
    });

    await prisma.similarityCase.deleteMany({ where: { matchId: matchRow.id } });
    for (const s of out.similarRefs.slice(0, 10)) {
      await prisma.similarityCase.create({
        data: {
          matchId: matchRow.id,
          refMatchExt: s.refMatchExt,
          similarity: s.similarity,
          result1x2: s.result1x2,
          score: s.score,
        },
      });
    }

    let confidence = out.confidence;
    let trustIndex = out.trustIndex;
    if (!allowSyntheticPredictions) {
      confidence = clamp(out.confidence + trackRecord.confidenceDelta, 0, 1);
      trustIndex = clamp(out.trustIndex + trackRecord.trustDelta, 8, 98);
    }

    const methodologyExtra =
      !allowSyntheticPredictions &&
      trackRecord.sampleSize >= TRACK_RECORD_MIN_N &&
      trackRecord.hitRate != null
        ? [
            `Platform track record: last ${trackRecord.sampleSize} actionable settled picks at ${(trackRecord.hitRate * 100).toFixed(1)}% 1X2 hits vs ${(NAIVE_BASELINE_1X2 * 100).toFixed(1)}% naive baseline; headline confidence nudged ${(trackRecord.confidenceDelta * 100).toFixed(2)}pp, trust ${trackRecord.trustDelta >= 0 ? "+" : ""}${trackRecord.trustDelta.toFixed(1)} pts (capped).`,
          ]
        : [];

    let confidenceDeltaPrev: number | null = null;
    let edgeOnPickPctDeltaPrev: number | null = null;
    let maxEdgeProbDeltaPrev: number | null = null;
    if (prevPred && !allowSyntheticPredictions && odds?.oddsSource === "book_matched") {
      confidenceDeltaPrev = confidence - prevPred.confidence;
      if (
        prevPred.snapshotHomeOdds != null &&
        prevPred.snapshotDrawOdds != null &&
        prevPred.snapshotAwayOdds != null
      ) {
        const oldEd = computeEdgeDetection(
          prevPred.snapshotHomeOdds,
          prevPred.snapshotDrawOdds,
          prevPred.snapshotAwayOdds,
          prevPred.calibratedHome,
          prevPred.calibratedDraw,
          prevPred.calibratedAway,
          prevPred.probHome,
          prevPred.probDraw,
          prevPred.probAway,
          prevPred.outcomePrediction,
          prevPred.confidence,
          prevPred.trustIndex,
          prevPred.noBet
        );
        const newEd = computeEdgeDetection(
          homeOdds,
          drawOdds,
          awayOdds,
          out.calibratedProbs.cHome,
          out.calibratedProbs.cDraw,
          out.calibratedProbs.cAway,
          out.modelProbs.pHome,
          out.modelProbs.pDraw,
          out.modelProbs.pAway,
          out.outcomePrediction,
          confidence,
          trustIndex,
          out.noBet
        );
        edgeOnPickPctDeltaPrev = newEd.edgeOnDisplayedPickPct - oldEd.edgeOnDisplayedPickPct;
        maxEdgeProbDeltaPrev = newEd.maxEdgeProb - oldEd.maxEdgeProb;
      }
    }

    const pred = await prisma.prediction.create({
      data: {
        matchId: matchRow.id,
        outcomePrediction: out.outcomePrediction,
        confidence,
        modelConfidence: out.modelConfidence,
        dataQualityScore: out.dataQualityScore,
        marketAlignmentScore: out.marketAlignmentScore,
        similarityScore: out.similarityScore,
        volatilityScore: out.volatilityScore,
        probHome: out.modelProbs.pHome,
        probDraw: out.modelProbs.pDraw,
        probAway: out.modelProbs.pAway,
        calibratedHome: out.calibratedProbs.cHome,
        calibratedDraw: out.calibratedProbs.cDraw,
        calibratedAway: out.calibratedProbs.cAway,
        goalsBandLow: out.goalsBand.low,
        goalsBandHigh: out.goalsBand.high,
        trustIndex,
        modelVersion: out.modelVersion,
        methodology: [...out.methodology, ...methodologyExtra] as unknown as object[],
        expectedHomeGoals: out.expectedHomeGoals,
        expectedAwayGoals: out.expectedAwayGoals,
        expectedTotalGoals: out.expectedTotalGoals,
        exactScore: out.exactScore,
        altScore: out.altScore,
        bttsPrediction: out.bttsPrediction,
        overUnderPrediction: out.overUnderPrediction,
        valueScore: out.valueScore,
        riskLevel: out.riskLevel,
        reasoning: out.reasoning,
        noBet: out.noBet,
        trapMatch: out.trapMatch,
        mockContext: allowSyntheticPredictions,
        snapshotHomeOdds: homeOdds,
        snapshotDrawOdds: drawOdds,
        snapshotAwayOdds: awayOdds,
        oddsMatchScore: odds?.matchQuality ?? null,
        confidenceDeltaPrev,
        edgeOnPickPctDeltaPrev,
        maxEdgeProbDeltaPrev,
        scenarios: out.scenarios as object[],
        similarityStats: out.similarityStats as object,
        factors: {
          create: out.factors.map((f) => ({
            name: f.name,
            weight: f.weight,
            contribution: f.contribution,
            detail: f.detail,
          })),
        },
      },
    });
    predCount += 1;
  }

  await settleFinishedMatches(prisma).catch((e) => {
    console.error("[pipeline] settlement failed", e);
  });

  await cacheDel("meta:leagues:v1").catch(() => undefined);

  return { matches: normalizedMatches.length, predictions: predCount };
}
