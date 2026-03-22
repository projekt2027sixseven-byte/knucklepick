import type { PrismaClient } from "@prisma/client";
import { fetchDailyMatches } from "../integrations/footballApi";
import { fetchOdds } from "../integrations/oddsApi";
import type { NormalizedMatch, NormalizedOdds } from "../integrations/types";
import { runPredictionEngine } from "../engines/predictionEngine";
import { resolveEngineWeights } from "../engines/weights";
import { loadEnv } from "../config/env";
import { computeEmpiricalMatchStats } from "./empiricalMatchStats";

function oddsForMatch(oddsList: NormalizedOdds[], match: NormalizedMatch): NormalizedOdds | null {
  const direct = oddsList.find((o) => o.matchExternalId === match.externalId);
  if (direct) return direct;
  if (oddsList.length === 1) return oddsList[0]!;
  return null;
}

export async function ingestAndPredict(prisma: PrismaClient): Promise<{ matches: number; predictions: number }> {
  const env = loadEnv();
  const mockData = Boolean(env.MOCK_DATA_MODE) || (!env.FOOTBALL_API_KEY && !env.ODDS_API_KEY);

  const weights = await resolveEngineWeights(async (key) => {
    const row = await prisma.engineWeight.findUnique({ where: { key } });
    return row?.value ?? null;
  });

  const normalizedMatches = await fetchDailyMatches();
  const oddsList = await fetchOdds(normalizedMatches);

  let predCount = 0;

  for (const m of normalizedMatches) {
    const odds = oddsForMatch(oddsList, m);
    const homeOdds = odds?.homeOdds ?? 2.2;
    const drawOdds = odds?.drawOdds ?? 3.2;
    const awayOdds = odds?.awayOdds ?? 3.0;

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

    await prisma.odds.create({
      data: {
        matchId: matchRow.id,
        bookmaker: odds?.bookmaker ?? (mockData ? "mock" : "synthetic"),
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
      mockData,
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
        return {
          externalId: h.externalId ?? h.id,
          homeOdds: o.homeOdds,
          drawOdds: o.drawOdds,
          awayOdds: o.awayOdds,
          impliedHome: imp.home / s,
          impliedDraw: imp.draw / s,
          impliedAway: imp.away / s,
          strengthGap: h.stats?.strengthGap ?? 0,
          homeForm: h.stats?.homeFormPts ?? 1.5,
          awayForm: h.stats?.awayFormPts ?? 1.5,
          result1x2: hg > ag ? ("HOME" as const) : ag > hg ? ("AWAY" as const) : ("DRAW" as const),
          totalGoals: hg + ag,
          homeGoals: hg,
          awayGoals: ag,
          btts: hg > 0 && ag > 0,
          over25: hg + ag > 2,
          scoreLabel: `${hg}-${ag}`,
        };
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
      mockData,
      weights,
      historicalPool: pool.length >= 8 ? pool : undefined,
      restDaysHome,
      restDaysAway,
      leagueStrengthIndex,
      rolling,
      empiricalBlend,
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

    const pred = await prisma.prediction.create({
      data: {
        matchId: matchRow.id,
        outcomePrediction: out.outcomePrediction,
        confidence: out.confidence,
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
        trustIndex: out.trustIndex,
        modelVersion: out.modelVersion,
        methodology: out.methodology as unknown as object[],
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

  return { matches: normalizedMatches.length, predictions: predCount };
}
