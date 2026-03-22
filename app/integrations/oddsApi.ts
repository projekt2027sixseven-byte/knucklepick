import { loadEnv } from "../config/env";
import { cacheGet, cacheSet } from "../utils/cache";
import type { NormalizedMatch, NormalizedOdds } from "./types";

const CACHE_TTL_ODDS = 60 * 15;

function mockMode(): boolean {
  try {
    const e = loadEnv();
    return Boolean(e.MOCK_DATA_MODE) || !e.ODDS_API_KEY;
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
    };
  });
}

async function fetchTheOddsApi(sportKey: string): Promise<NormalizedOdds[]> {
  const env = loadEnv();
  const key = env.ODDS_API_KEY!;
  const cacheKey = `odds:${sportKey}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return JSON.parse(hit) as NormalizedOdds[];

  const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal`;
  const res = await fetch(url, { headers: { "x-apis-key": key } });
  if (!res.ok) throw new Error(`Odds API failed: ${res.status}`);
  const arr = (await res.json()) as {
    id: string;
    bookmakers?: {
      key: string;
      markets: {
        key: string;
        outcomes: { name: string; price: number }[];
      }[];
    }[];
  }[];

  const out: NormalizedOdds[] = [];
  for (const ev of arr) {
    const bm = ev.bookmakers?.[0];
    if (!bm) continue;
    const h2h = bm.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;
    const byName = Object.fromEntries(h2h.outcomes.map((o) => [o.name.toLowerCase(), o.price]));
    const home = byName["home"] ?? byName[Object.keys(byName)[0]];
    const away = byName["away"] ?? byName[Object.keys(byName)[1]];
    const draw = byName["draw"];
    if (!home || !away) continue;
    const totals = bm.markets.find((m) => m.key === "totals");
    let over25: number | undefined;
    let under25: number | undefined;
    if (totals) {
      for (const o of totals.outcomes) {
        if (o.name.toLowerCase().includes("over")) over25 = o.price;
        if (o.name.toLowerCase().includes("under")) under25 = o.price;
      }
    }
    out.push({
      matchExternalId: ev.id,
      bookmaker: bm.key,
      homeOdds: home,
      drawOdds: draw ?? (home + away) / 2,
      awayOdds: away,
      over25,
      under25,
    });
  }
  await cacheSet(cacheKey, JSON.stringify(out), CACHE_TTL_ODDS);
  return out;
}

export async function fetchOdds(matches: NormalizedMatch[]): Promise<NormalizedOdds[]> {
  if (mockMode()) return generateMockOddsForMatches(matches);
  try {
    return await fetchTheOddsApi("soccer_epl");
  } catch {
    return generateMockOddsForMatches(matches);
  }
}
