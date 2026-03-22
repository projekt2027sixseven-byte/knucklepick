import type { PrismaClient } from "@prisma/client";
import type { RollingForLambda } from "../engines/empiricalRatings";

const ROLLING_WINDOW = 8;
const MIN_MATCHES_FOR_EMPIRICAL = 3;
const LEAGUE_AVG_SAMPLE = 220;
const DEFAULT_LEAGUE_AVG_GOALS = 2.65;

export type EmpiricalMatchStatsResult = {
  homeFormPts: number;
  awayFormPts: number;
  homeXG: number;
  awayXG: number;
  homeGoalsAgainstAvg: number;
  awayGoalsAgainstAvg: number;
  strengthGap: number;
  restDaysHome: number;
  restDaysAway: number;
  leagueStrengthIndex: number;
  hasStats: boolean;
  empiricalBlend: number;
  rolling: RollingForLambda | null;
  /** For persistence — rolling GF/game when available. */
  homeGFPerGame?: number;
  awayGFPerGame?: number;
};

type FtRow = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  utcDate: Date;
};

function goalsForTeam(match: FtRow, teamId: string): { gf: number; ga: number } {
  if (match.homeTeamId === teamId) return { gf: match.homeScore, ga: match.awayScore };
  return { gf: match.awayScore, ga: match.homeScore };
}

function points1x2(match: FtRow, teamId: string): number {
  const { gf, ga } = goalsForTeam(match, teamId);
  if (gf > ga) return 3;
  if (gf === ga) return 1;
  return 0;
}

async function fetchTeamFinishedMatches(
  prisma: PrismaClient,
  teamId: string,
  before: Date,
  excludeMatchId: string,
  take: number
) {
  return prisma.match.findMany({
    where: {
      status: "FT",
      utcDate: { lt: before },
      id: { not: excludeMatchId },
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { utcDate: "desc" },
    take,
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      utcDate: true,
    },
  });
}

async function lastMatchBefore(
  prisma: PrismaClient,
  teamId: string,
  before: Date,
  excludeMatchId: string
) {
  return prisma.match.findFirst({
    where: {
      status: "FT",
      utcDate: { lt: before },
      id: { not: excludeMatchId },
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { utcDate: "desc" },
    select: { utcDate: true },
  });
}

async function leagueAverageGoalsPerGame(
  prisma: PrismaClient,
  leagueId: string | null,
  before: Date
): Promise<number> {
  const where = {
    status: "FT" as const,
    utcDate: { lt: before },
    homeScore: { not: null },
    awayScore: { not: null },
    ...(leagueId ? { leagueId } : {}),
  };
  const rows = await prisma.match.findMany({
    where,
    orderBy: { utcDate: "desc" },
    take: LEAGUE_AVG_SAMPLE,
    select: { homeScore: true, awayScore: true },
  });
  if (rows.length === 0) return DEFAULT_LEAGUE_AVG_GOALS;
  const sum = rows.reduce((s, m) => s + m.homeScore! + m.awayScore!, 0);
  return sum / rows.length;
}

function impliedFallbackFromOdds(homeOdds: number, drawOdds: number, awayOdds: number, leagueAvgGoals: number) {
  const inv = [1 / homeOdds, 1 / drawOdds, 1 / awayOdds];
  const s = inv[0]! + inv[1]! + inv[2]!;
  const pH = inv[0]! / s;
  const pA = inv[2]! / s;
  const d = pH - pA;
  const half = leagueAvgGoals / 2;
  const homeFormPts = 1.35 + d * 1.35;
  const awayFormPts = 1.35 - d * 1.35;
  const homeXG = clamp(half + d * 0.42, 0.55, 2.8);
  const awayXG = clamp(half - d * 0.42, 0.55, 2.8);
  const ga = clamp(half * 0.92 + (1 - Math.max(pH, pA)) * 0.15, 0.55, 2.4);
  return {
    homeFormPts,
    awayFormPts,
    homeXG,
    awayXG,
    homeGoalsAgainstAvg: ga,
    awayGoalsAgainstAvg: ga,
    strengthGap: homeFormPts - awayFormPts,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Rolling team form and goal rates from finished matches in the database.
 * When history is thin, falls back to market-implied priors (not random noise).
 */
export async function computeEmpiricalMatchStats(
  prisma: PrismaClient,
  opts: {
    homeTeamId: string;
    awayTeamId: string;
    leagueId: string | null;
    matchUtcDate: Date;
    excludeMatchId: string;
    mockData: boolean;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
  }
): Promise<EmpiricalMatchStatsResult> {
  const { homeTeamId, awayTeamId, leagueId, matchUtcDate, excludeMatchId, mockData, homeOdds, drawOdds, awayOdds } =
    opts;

  const leagueAvgGoals = await leagueAverageGoalsPerGame(prisma, leagueId, matchUtcDate);
  const leagueStrengthIndex = clamp(leagueAvgGoals / DEFAULT_LEAGUE_AVG_GOALS, 0.82, 1.18);

  const [homeRows, awayRows] = await Promise.all([
    fetchTeamFinishedMatches(prisma, homeTeamId, matchUtcDate, excludeMatchId, ROLLING_WINDOW),
    fetchTeamFinishedMatches(prisma, awayTeamId, matchUtcDate, excludeMatchId, ROLLING_WINDOW),
  ]);

  const nHome = homeRows.length;
  const nAway = awayRows.length;

  const fb = impliedFallbackFromOdds(homeOdds, drawOdds, awayOdds, leagueAvgGoals);

  if (nHome < MIN_MATCHES_FOR_EMPIRICAL || nAway < MIN_MATCHES_FOR_EMPIRICAL) {
    const lastH = await lastMatchBefore(prisma, homeTeamId, matchUtcDate, excludeMatchId);
    const lastA = await lastMatchBefore(prisma, awayTeamId, matchUtcDate, excludeMatchId);
    const restDaysHome = lastH ? Math.max(0, Math.floor((matchUtcDate.getTime() - lastH.utcDate.getTime()) / 86_400_000)) : 0;
    const restDaysAway = lastA ? Math.max(0, Math.floor((matchUtcDate.getTime() - lastA.utcDate.getTime()) / 86_400_000)) : 0;

    return {
      ...fb,
      restDaysHome,
      restDaysAway,
      leagueStrengthIndex,
      hasStats: false,
      empiricalBlend: 0,
      rolling: null,
      homeGFPerGame: undefined,
      awayGFPerGame: undefined,
    };
  }

  let homePts = 0;
  let homeGf = 0;
  let homeGa = 0;
  for (const m of homeRows) {
    if (m.homeScore == null || m.awayScore == null) continue;
    const row: FtRow = { ...m, homeScore: m.homeScore, awayScore: m.awayScore };
    homePts += points1x2(row, homeTeamId);
    const g = goalsForTeam(row, homeTeamId);
    homeGf += g.gf;
    homeGa += g.ga;
  }

  let awayPts = 0;
  let awayGf = 0;
  let awayGa = 0;
  for (const m of awayRows) {
    if (m.homeScore == null || m.awayScore == null) continue;
    const row: FtRow = { ...m, homeScore: m.homeScore, awayScore: m.awayScore };
    awayPts += points1x2(row, awayTeamId);
    const g = goalsForTeam(row, awayTeamId);
    awayGf += g.gf;
    awayGa += g.ga;
  }

  const homeFormPts = homePts / nHome;
  const awayFormPts = awayPts / nAway;
  const homeGFpg = homeGf / nHome;
  const homeGApg = homeGa / nHome;
  const awayGFpg = awayGf / nAway;
  const awayGApg = awayGa / nAway;

  const half = leagueAvgGoals / 2;
  const homeXG = clamp(0.88 * homeGFpg + 0.12 * half, 0.45, 3.2);
  const awayXG = clamp(0.88 * awayGFpg + 0.12 * half, 0.45, 3.2);

  const lastH = homeRows[0] ?? (await lastMatchBefore(prisma, homeTeamId, matchUtcDate, excludeMatchId));
  const lastA = awayRows[0] ?? (await lastMatchBefore(prisma, awayTeamId, matchUtcDate, excludeMatchId));

  const restDaysHome = lastH
    ? Math.max(0, Math.floor((matchUtcDate.getTime() - lastH.utcDate.getTime()) / 86_400_000))
    : 0;
  const restDaysAway = lastA
    ? Math.max(0, Math.floor((matchUtcDate.getTime() - lastA.utcDate.getTime()) / 86_400_000))
    : 0;

  const strengthGap = homeFormPts - awayFormPts;

  const depth = Math.min(nHome, nAway);
  const empiricalBlend = clamp(0.28 + 0.52 * Math.min(1, depth / ROLLING_WINDOW), 0, 0.82);

  const rolling: RollingForLambda = {
    homeGF: homeGFpg,
    homeGA: homeGApg,
    awayGF: awayGFpg,
    awayGA: awayGApg,
    nHome,
    nAway,
    leagueAvgGoalsPerGame: leagueAvgGoals,
  };

  return {
    homeFormPts,
    awayFormPts,
    homeXG,
    awayXG,
    homeGoalsAgainstAvg: homeGApg,
    awayGoalsAgainstAvg: awayGApg,
    strengthGap,
    restDaysHome,
    restDaysAway,
    leagueStrengthIndex,
    hasStats: !mockData && nHome >= MIN_MATCHES_FOR_EMPIRICAL && nAway >= MIN_MATCHES_FOR_EMPIRICAL,
    empiricalBlend: mockData ? empiricalBlend * 0.45 : empiricalBlend,
    rolling,
    homeGFPerGame: homeGFpg,
    awayGFPerGame: awayGFpg,
  };
}
