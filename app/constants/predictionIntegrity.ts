/** Minimum fuzzy score (0–1) for The Odds API ↔ fixture alignment before we emit a prediction. */
export const MIN_ODDS_MATCH_SCORE = 0.75;

/** Second-place must be at least this far below the winner or the book–fixture pairing is ambiguous. */
export const ODDS_MATCH_AMBIGUITY_GAP = 0.04;

/** Minimum per-side fuzzy match between football fixture names and book event names (post-orientation). */
export const MIN_TEAM_CROSSCHECK_SCORE = 0.55;

/** Stricter alignment when kickoff is within this window (ms). */
export const NEAR_KICKOFF_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Minimum book–fixture score when kickoff is soon — reduces wrong-book risk. */
export const MIN_ODDS_MATCH_SCORE_NEAR_KICKOFF = 0.78;

/** Public labels (stored on Match.reliabilityFlags). */
export const RELIABILITY_UNRELIABLE_MATCH = "UNRELIABLE_MATCH";
export const RELIABILITY_LOW_DATA_QUALITY = "LOW_DATA_QUALITY";
