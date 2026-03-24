import { loadEnv } from "../config/env";
import { cacheGet, cacheSet } from "../utils/cache";
import type { NormalizedMatch, NormalizedTeamStats } from "./types";

const CACHE_TTL = 60 * 15;

/** True when user forces demo data or no API key is configured. */
function forceMockOnly(): boolean {
  try {
    const e = loadEnv();
    return Boolean(e.MOCK_DATA_MODE) || !e.FOOTBALL_API_KEY?.trim();
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

/** European season year for API-Football (July → new season). */
export function getCurrentSeasonYear(): number {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return m >= 7 ? y : y - 1;
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today (UTC) through +7 days — upcoming window for the deck. */
function fixtureWindow(): { from: string; to: string } {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { from: utcDateString(start), to: utcDateString(end) };
}

type ApiFixtureRow = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; country: string; logo?: string; season?: number };
  teams: {
    home: { id: number; name: string; code?: string; logo?: string };
    away: { id: number; name: string; code?: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
};

function mapFixtureRow(r: ApiFixtureRow): NormalizedMatch {
  const season = r.league.season != null ? String(r.league.season) : String(getCurrentSeasonYear());
  return {
    externalId: String(r.fixture.id),
    utcDate: r.fixture.date,
    status: r.fixture.status.short,
    season,
    home: {
      externalId: String(r.teams.home.id),
      name: r.teams.home.name,
      shortName: r.teams.home.code ?? r.teams.home.name.slice(0, 3).toUpperCase(),
      logoUrl: r.teams.home.logo,
      leagueExternalId: String(r.league.id),
      leagueName: r.league.name,
      country: r.league.country,
    },
    away: {
      externalId: String(r.teams.away.id),
      name: r.teams.away.name,
      shortName: r.teams.away.code ?? r.teams.away.name.slice(0, 3).toUpperCase(),
      logoUrl: r.teams.away.logo,
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
  };
}

async function fetchFixturesFromApiFootball(): Promise<NormalizedMatch[]> {
  const env = loadEnv();
  const key = env.FOOTBALL_API_KEY!.trim();
  const { from, to } = fixtureWindow();
  const cacheKey = `football:fixtures:v2:${from}:${to}`;
  const hit = await cacheGet(cacheKey);
  if (hit) {
    try {
      return JSON.parse(hit) as NormalizedMatch[];
    } catch {
      /* refetch */
    }
  }

  const url = `https://v3.football.api-sports.io/fixtures?from=${from}&to=${to}&timezone=UTC`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Football API fixtures failed: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { response?: ApiFixtureRow[] };
  const rows = json.response ?? [];
  const seen = new Set<string>();
  const normalized: NormalizedMatch[] = [];
  for (const r of rows) {
    const id = String(r.fixture.id);
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(mapFixtureRow(r));
  }
  normalized.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const capped = normalized.slice(0, 150);
  await cacheSet(cacheKey, JSON.stringify(capped), CACHE_TTL);
  return capped;
}

export type FetchMatchesResult = {
  matches: NormalizedMatch[];
  /** `api` when live API-Football returned data; `mock` when forced or on failure fallback. */
  source: "api" | "mock";
  error?: string;
};

/**
 * Fixtures for the ingest window (today → +7d UTC) from API-Football when `FOOTBALL_API_KEY` is set
 * and `MOCK_DATA_MODE` is not true. On failure, falls back to generated fixtures (dashboard still works).
 */
export async function fetchDailyMatches(): Promise<FetchMatchesResult> {
  if (forceMockOnly()) {
    return { matches: generateMockMatches(28), source: "mock" };
  }
  try {
    const matches = await fetchFixturesFromApiFootball();
    return { matches, source: "api" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[footballApi] fetch failed, using mock fallback:", msg);
    return { matches: generateMockMatches(28), source: "mock", error: msg };
  }
}

function parseFormToPointsAvg(form: string | undefined): number | null {
  if (!form || form.length < 3) return null;
  let pts = 0;
  let n = 0;
  for (const ch of form.toUpperCase()) {
    if (ch === "W") {
      pts += 3;
      n += 1;
    } else if (ch === "D") {
      pts += 1;
      n += 1;
    } else if (ch === "L") {
      n += 1;
    }
  }
  if (n === 0) return null;
  return pts / n;
}

export async function fetchTeamStats(
  teamExternalId: string,
  leagueExternalId?: string
): Promise<NormalizedTeamStats | null> {
  if (forceMockOnly()) {
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
  const key = env.FOOTBALL_API_KEY!.trim();
  const season = getCurrentSeasonYear();
  let url = `https://v3.football.api-sports.io/teams/statistics?team=${teamExternalId}&season=${season}`;
  if (leagueExternalId) {
    url += `&league=${leagueExternalId}`;
  }
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    response?: {
      form?: string;
      goals?: { for?: { average?: { total?: unknown } }; against?: { average?: { total?: unknown } } };
    };
  };
  const r = json.response;
  if (!r) return null;
  type GoalsAvg = { for?: { average?: { total?: unknown } }; against?: { average?: { total?: unknown } } };
  const goals = r.goals as GoalsAvg | undefined;
  const gf = Number(goals?.for?.average?.total ?? 1.2);
  const ga = Number(goals?.against?.average?.total ?? 1.1);
  const formPts = parseFormToPointsAvg(r.form) ?? 1.5;

  let leagueRank: number | undefined;
  if (leagueExternalId) {
    try {
      const st = await fetch(
        `https://v3.football.api-sports.io/standings?league=${leagueExternalId}&season=${season}`,
        { headers: { "x-apisports-key": key } }
      );
      if (st.ok) {
        const sj = (await st.json()) as {
          response?: { league?: { standings?: { rank: number; team: { id: number } }[][] } }[];
        };
        const groups = sj.response?.[0]?.league?.standings;
        const tid = Number(teamExternalId);
        if (Array.isArray(groups)) {
          for (const group of groups) {
            if (!Array.isArray(group)) continue;
            const row = group.find((x) => x.team?.id === tid);
            if (row) {
              leagueRank = row.rank;
              break;
            }
          }
        }
      }
    } catch {
      /* standings optional */
    }
  }

  return {
    teamExternalId,
    formPointsAvg: formPts,
    xGFor: gf,
    xGAgainst: ga,
    goalsForAvg: gf,
    goalsAgainstAvg: ga,
    formRecent: r.form,
    leagueRank,
  };
}
