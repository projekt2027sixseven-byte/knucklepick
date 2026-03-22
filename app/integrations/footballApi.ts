import { loadEnv } from "../config/env";
import { cacheGet, cacheSet } from "../utils/cache";
import type { NormalizedMatch, NormalizedTeamStats } from "./types";

const CACHE_TTL = 60 * 30;

function mockMode(): boolean {
  try {
    const e = loadEnv();
    return Boolean(e.MOCK_DATA_MODE) || !e.FOOTBALL_API_KEY;
  } catch {
    return true;
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function generateMockMatches(count = 24): NormalizedMatch[] {
  const leagues = [
    { externalId: "pl", name: "Premier League", country: "England" },
    { externalId: "laliga", name: "La Liga", country: "Spain" },
    { externalId: "seriea", name: "Serie A", country: "Italy" },
  ];
  const teams = [
    "City United",
    "North Rovers",
    "Harbor FC",
    "Central Athletic",
    "River Town",
    "Coastal SC",
    "Metro Lions",
    "Valley Rangers",
    "Summit FC",
    "Harbor Athletic",
    "Iron Gate",
    "Crown City",
  ];
  const out: NormalizedMatch[] = [];
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < count; i++) {
    const h = teams[i % teams.length];
    const a = teams[(i + 3 + (i % 4)) % teams.length];
    const lg = leagues[i % leagues.length];
    const homeId = `t_${lg.externalId}_${slug(h)}`;
    const awayId = `t_${lg.externalId}_${slug(a)}`;
    out.push({
      externalId: `m_${day}_${lg.externalId}_${slug(h)}_${slug(a)}`,
      utcDate: new Date(now + (i + 1) * 3.6e6).toISOString(),
      status: "SCHEDULED",
      season: "2025",
      home: {
        externalId: homeId,
        name: h,
        shortName: h.slice(0, 3).toUpperCase(),
        leagueExternalId: lg.externalId,
        leagueName: lg.name,
        country: lg.country,
      },
      away: {
        externalId: awayId,
        name: a,
        shortName: a.slice(0, 3).toUpperCase(),
        leagueExternalId: lg.externalId,
        leagueName: lg.name,
        country: lg.country,
      },
      league: { externalId: lg.externalId, name: lg.name, country: lg.country },
    });
  }
  return out;
}

async function fetchFromApiFootball(): Promise<NormalizedMatch[]> {
  const env = loadEnv();
  const key = env.FOOTBALL_API_KEY!;
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `football:matches:${today}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return JSON.parse(hit) as NormalizedMatch[];

  const url = `https://v3.football.api-sports.io/fixtures?date=${today}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`Football API fixtures failed: ${res.status}`);
  const json = (await res.json()) as {
    response?: {
      fixture: { id: number; date: string; status: { short: string } };
      league: { id: number; name: string; country: string; logo?: string };
      teams: {
        home: { id: number; name: string };
        away: { id: number; name: string };
      };
      goals: { home: number | null; away: number | null };
    }[];
  };
  const rows = json.response ?? [];
  const normalized: NormalizedMatch[] = rows.map((r) => ({
    externalId: String(r.fixture.id),
    utcDate: r.fixture.date,
    status: r.fixture.status.short,
    home: {
      externalId: String(r.teams.home.id),
      name: r.teams.home.name,
      leagueExternalId: String(r.league.id),
      leagueName: r.league.name,
      country: r.league.country,
    },
    away: {
      externalId: String(r.teams.away.id),
      name: r.teams.away.name,
      leagueExternalId: String(r.league.id),
      leagueName: r.league.name,
      country: r.league.country,
    },
    league: {
      externalId: String(r.league.id),
      name: r.league.name,
      country: r.league.country,
      logoUrl: r.league.logo,
    },
    homeScore: r.goals.home ?? undefined,
    awayScore: r.goals.away ?? undefined,
  }));

  await cacheSet(cacheKey, JSON.stringify(normalized), CACHE_TTL);
  return normalized;
}

export async function fetchDailyMatches(): Promise<NormalizedMatch[]> {
  if (mockMode()) return generateMockMatches(28);
  return fetchFromApiFootball();
}

export async function fetchTeamStats(teamExternalId: string): Promise<NormalizedTeamStats | null> {
  if (mockMode()) {
    return {
      teamExternalId,
      formPointsAvg: 1.2 + Math.random() * 1.6,
      xGFor: 1.1 + Math.random(),
      xGAgainst: 0.9 + Math.random() * 0.8,
      goalsForAvg: 1.3 + Math.random() * 0.9,
      goalsAgainstAvg: 1.0 + Math.random() * 0.7,
    };
  }
  const env = loadEnv();
  const key = env.FOOTBALL_API_KEY!;
  const url = `https://v3.football.api-sports.io/teams/statistics?team=${teamExternalId}&season=2024`;
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) return null;
  const json = (await res.json()) as { response?: Record<string, unknown> };
  const r = json.response;
  if (!r) return null;
  type GoalsAvg = { for?: { average?: { total?: unknown } }; against?: { average?: { total?: unknown } } };
  const goals = r["goals"] as GoalsAvg | undefined;
  return {
    teamExternalId,
    formPointsAvg: 1.5,
    xGFor: Number(goals?.for?.average?.total ?? 1.2),
    xGAgainst: Number(goals?.against?.average?.total ?? 1.1),
    goalsForAvg: Number(goals?.for?.average?.total ?? 1.2),
    goalsAgainstAvg: Number(goals?.against?.average?.total ?? 1.1),
  };
}
