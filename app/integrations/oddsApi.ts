import { loadEnv } from "../config/env";
import { ODDS_MATCH_AMBIGUITY_GAP } from "../constants/predictionIntegrity";
import { cacheGet, cacheSet } from "../utils/cache";
import type { NormalizedMatch, NormalizedOdds } from "./types";

const CACHE_TTL_ODDS = 60 * 12;

/** Top leagues on The Odds API — fetched in parallel, then matched to fixtures by team names. */
const SPORT_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_netherlands_eredivisie",
  "soccer_portugal_primeira_liga",
  "soccer_belgium_first_div",
];

function forceMockOdds(): boolean {
  try {
    const e = loadEnv();
    return Boolean(e.MOCK_DATA_MODE) || !e.ODDS_API_KEY?.trim();
  } catch {
    return true;
  }
}

export function generateMockOddsForMatches(matches: NormalizedMatch[]): NormalizedOdds[] {
  return matches.map((m, i) => {
    const drift = 0.85 + (i % 7) * 0.04;
    const home = Number((2.1 * drift + Math.random() * 0.4).toFixed(2));
    const draw = Number((3.2 + Math.random() * 0.5).toFixed(2));
    const away = Number((3.0 * (2 - drift) + Math.random() * 0.6).toFixed(2));
    return {
      matchExternalId: m.externalId,
      bookmaker: "mock",
      homeOdds: home,
      drawOdds: draw,
      awayOdds: away,
      over25: Number((1.85 + Math.random() * 0.25).toFixed(2)),
      under25: Number((1.95 + Math.random() * 0.25).toFixed(2)),
      bttsYes: Number((1.75 + Math.random() * 0.3).toFixed(2)),
      bttsNo: Number((2.0 + Math.random() * 0.3).toFixed(2)),
      oddsSource: "synthetic" as const,
    };
  });
}

/** Normalize for fuzzy team matching across providers (API-Football vs The Odds API). */
export function normalizeTeamName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(fc|cf|sc|afc|sv|ac|ud|cd|as|fk|sk|bk)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchScore(a: string, b: string): number {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na.length || !nb.length) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.94;
  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = new Set(nb.split(" ").filter((t) => t.length > 2));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const denom = Math.max(ta.size, tb.size, 1);
  return inter / denom;
}

type RawOddsEvent = {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers?: {
    key: string;
    markets: {
      key: string;
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
};

function extractFromBookmaker(ev: RawOddsEvent): Omit<NormalizedOdds, "matchExternalId"> | null {
  const bm = ev.bookmakers?.[0];
  if (!bm) return null;
  const h2h = bm.markets.find((m) => m.key === "h2h");
  if (!h2h?.outcomes?.length) return null;
  const drawOutcome = h2h.outcomes.find((o) => o.name.toLowerCase() === "draw");
  const nonDraw = h2h.outcomes.filter((o) => o.name.toLowerCase() !== "draw");
  if (nonDraw.length < 2) return null;

  const scored = nonDraw.map((o) => ({
    price: o.price,
    sh: matchScore(o.name, ev.home_team),
    sa: matchScore(o.name, ev.away_team),
  }));
  const byHome = [...scored].sort((a, b) => b.sh - a.sh);
  const byAway = [...scored].sort((a, b) => b.sa - a.sa);
  let homePick = byHome[0]!;
  let awayPick = byAway[0]!;
  if (homePick === awayPick && scored.length >= 2) {
    awayPick = byAway.find((p) => p !== homePick) ?? byHome[1]!;
  }
  const home = homePick.price;
  const away = awayPick.price;
  const draw = drawOutcome?.price ?? (home + away) / 2;
  if (!Number.isFinite(home + away + draw)) return null;

  let over25: number | undefined;
  let under25: number | undefined;
  const totals = bm.markets.find((m) => m.key === "totals");
  if (totals) {
    for (const o of totals.outcomes) {
      const n = o.name.toLowerCase();
      const pt = o.point ?? 2.5;
      if (n.includes("over") && (pt === 2.5 || Math.abs(pt - 2.5) < 0.01)) over25 = o.price;
      if (n.includes("under") && (pt === 2.5 || Math.abs(pt - 2.5) < 0.01)) under25 = o.price;
    }
  }

  let bttsYes: number | undefined;
  let bttsNo: number | undefined;
  const btts = bm.markets.find((m) => m.key === "btts" || m.key === "both_teams_to_score");
  if (btts) {
    for (const o of btts.outcomes) {
      const n = o.name.toLowerCase();
      if (n.includes("yes")) bttsYes = o.price;
      if (n.includes("no")) bttsNo = o.price;
    }
  }

  return {
    bookmaker: bm.key,
    homeOdds: home,
    drawOdds: draw,
    awayOdds: away,
    over25,
    under25,
    bttsYes,
    bttsNo,
  };
}

async function fetchOddsEventsForSport(sportKey: string): Promise<RawOddsEvent[]> {
  const env = loadEnv();
  const key = env.ODDS_API_KEY!;
  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=eu&markets=h2h,totals,btts&oddsFormat=decimal`;
  const res = await fetch(url, { headers: { "x-apis-key": key } });
  if (!res.ok) return [];
  return (await res.json()) as RawOddsEvent[];
}

async function fetchAllOddsEventsCached(): Promise<RawOddsEvent[]> {
  const env = loadEnv();
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `odds:events:v3:${day}`;
  const hit = await cacheGet(cacheKey);
  if (hit) {
    try {
      return JSON.parse(hit) as RawOddsEvent[];
    } catch {
      /* continue */
    }
  }

  const batches = await Promise.all(SPORT_KEYS.map((k) => fetchOddsEventsForSport(k)));
  const merged: RawOddsEvent[] = [];
  const seen = new Set<string>();
  for (const batch of batches) {
    for (const ev of batch) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      merged.push(ev);
    }
  }
  await cacheSet(cacheKey, JSON.stringify(merged), CACHE_TTL_ODDS);
  return merged;
}

export type BookMatchedOdds = {
  extracted: Omit<NormalizedOdds, "matchExternalId" | "matchQuality" | "oddsSource">;
  score: number;
  bookHomeTeam: string;
  bookAwayTeam: string;
};

/**
 * Match The Odds API events to our fixtures by team names (IDs differ from API-Football).
 * Picks the highest combined fuzzy score for (home, away) orientation.
 * Drops ambiguous pairings (two events scoring within ODDS_MATCH_AMBIGUITY_GAP).
 */
export function matchOddsEventsToMatches(
  matches: NormalizedMatch[],
  events: RawOddsEvent[]
): Map<string, BookMatchedOdds> {
  const map = new Map<string, BookMatchedOdds>();
  for (const m of matches) {
    type Cand = { score: number; ev: RawOddsEvent; orientation: "normal" | "swap" };
    const candidates: Cand[] = [];
    for (const ev of events) {
      const sDirect =
        matchScore(m.home.name, ev.home_team) * 0.52 + matchScore(m.away.name, ev.away_team) * 0.48;
      const sSwap =
        matchScore(m.home.name, ev.away_team) * 0.52 + matchScore(m.away.name, ev.home_team) * 0.48;
      const orientation = sDirect >= sSwap ? ("normal" as const) : ("swap" as const);
      const score = Math.max(sDirect, sSwap);
      if (score < 0.62) continue;
      const raw = extractFromBookmaker(ev);
      if (!raw) continue;
      candidates.push({ score, ev, orientation });
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length === 0) continue;
    const top = candidates[0]!;
    const second = candidates[1];
    if (
      second &&
      top.score - second.score < ODDS_MATCH_AMBIGUITY_GAP &&
      second.score >= 0.62
    ) {
      continue;
    }
    const { ev, orientation } = top;
    const raw = extractFromBookmaker(ev);
    if (!raw) continue;
    const extracted =
      orientation === "swap"
        ? {
            ...raw,
            homeOdds: raw.awayOdds,
            awayOdds: raw.homeOdds,
          }
        : raw;
    const bookHomeTeam = orientation === "normal" ? ev.home_team : ev.away_team;
    const bookAwayTeam = orientation === "normal" ? ev.away_team : ev.home_team;
    map.set(m.externalId, { score: top.score, extracted, bookHomeTeam, bookAwayTeam });
  }
  return map;
}

export type FetchOddsResult = {
  odds: NormalizedOdds[];
  /** `api` when The Odds API was queried; `mock` when forced or full failure. */
  source: "api" | "mock";
  error?: string;
};

/**
 * 1X2 (+ totals / BTTS when bookmakers expose them) from The Odds API, matched to fixtures by team names.
 * Unmatched fixtures get numerically plausible synthetic odds so the pipeline never breaks.
 */
export async function fetchOdds(matches: NormalizedMatch[]): Promise<FetchOddsResult> {
  if (forceMockOdds()) {
    return { odds: generateMockOddsForMatches(matches), source: "mock" };
  }
  if (matches.length === 0) return { odds: [], source: "api" };
  try {
    const events = await fetchAllOddsEventsCached();
    const mapped = matchOddsEventsToMatches(matches, events);
    const fallback = generateMockOddsForMatches(matches);
    const byId = new Map(fallback.map((o) => [o.matchExternalId, o]));
    const odds = matches.map((m) => {
      const live = mapped.get(m.externalId);
      if (live) {
        return {
          matchExternalId: m.externalId,
          ...live.extracted,
          matchQuality: live.score,
          oddsSource: "book_matched" as const,
          bookEventHome: live.bookHomeTeam,
          bookEventAway: live.bookAwayTeam,
        };
      }
      return byId.get(m.externalId)!;
    });
    return { odds, source: "api" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[oddsApi] fetch failed, using synthetic odds fallback:", msg);
    return { odds: generateMockOddsForMatches(matches), source: "mock", error: msg };
  }
}
