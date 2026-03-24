import type { OddsBand } from "../engines/oddsContext";
import type { TotalGoalsBand } from "../utils/ouInference";

export type NormalizedTeam = {
  externalId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  leagueExternalId?: string;
  leagueName?: string;
  country?: string;
};

export type NormalizedMatch = {
  externalId: string;
  utcDate: string;
  status: string;
  season?: string;
  home: NormalizedTeam;
  away: NormalizedTeam;
  league?: { externalId: string; name: string; country?: string; logoUrl?: string };
  homeScore?: number;
  awayScore?: number;
};

export type NormalizedOdds = {
  matchExternalId: string;
  bookmaker?: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
  /** Set when matched to a book event; used for gating predictions. */
  matchQuality?: number;
  /** `book_matched` = real alignment; `synthetic` = filler (must not produce “live” predictions). */
  oddsSource?: "book_matched" | "synthetic";
  /** Book event team names after orientation alignment (same order as fixture home/away). */
  bookEventHome?: string;
  bookEventAway?: string;
};

export type NormalizedTeamStats = {
  teamExternalId: string;
  formPointsAvg: number;
  xGFor: number;
  xGAgainst: number;
  goalsForAvg: number;
  goalsAgainstAvg: number;
  /** Last matches form string from API (e.g. WWDLW) when available */
  formRecent?: string;
  /** League table rank when standings were fetched */
  leagueRank?: number;
};

export type HistoricalMatchForSimilarity = {
  externalId: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  strengthGap: number;
  homeForm: number;
  awayForm: number;
  /** Pre-match 1X2 structural bucket (for cohort matching). */
  oddsBand: OddsBand;
  /** Realized total-goals bucket (ex-post). */
  totalBand: TotalGoalsBand;
  result1x2: "HOME" | "DRAW" | "AWAY";
  totalGoals: number;
  homeGoals: number;
  awayGoals: number;
  btts: boolean;
  over25: boolean;
  scoreLabel: string;
};
