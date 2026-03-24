import type { NormalizedMatch, NormalizedOdds } from "../integrations/types";
import { matchScore } from "../integrations/oddsApi";
import {
  MIN_ODDS_MATCH_SCORE,
  MIN_ODDS_MATCH_SCORE_NEAR_KICKOFF,
  MIN_TEAM_CROSSCHECK_SCORE,
  NEAR_KICKOFF_WINDOW_MS,
  RELIABILITY_LOW_DATA_QUALITY,
  RELIABILITY_UNRELIABLE_MATCH,
} from "../constants/predictionIntegrity";

export type LiveOddsValidation =
  | { ok: true }
  | { ok: false; reason: string; flags: string[] };

/**
 * Extra checks for real book odds: team cross-check and stricter alignment near kickoff.
 * Synthetic / mock odds skip this (handled by caller).
 */
export function validateLiveBookOdds(m: NormalizedMatch, odds: NormalizedOdds, nowMs: number): LiveOddsValidation {
  if (odds.oddsSource !== "book_matched") return { ok: true };

  const mq = odds.matchQuality ?? 0;
  if (mq < MIN_ODDS_MATCH_SCORE) {
    return {
      ok: false,
      reason: "odds_alignment_below_threshold",
      flags: [RELIABILITY_UNRELIABLE_MATCH, RELIABILITY_LOW_DATA_QUALITY],
    };
  }

  const bh = odds.bookEventHome?.trim() ?? "";
  const ba = odds.bookEventAway?.trim() ?? "";
  if (!bh || !ba) {
    return {
      ok: false,
      reason: "fixture_book_team_names_missing",
      flags: [RELIABILITY_UNRELIABLE_MATCH],
    };
  }

  const crossHome = matchScore(m.home.name, bh);
  const crossAway = matchScore(m.away.name, ba);
  if (crossHome < MIN_TEAM_CROSSCHECK_SCORE || crossAway < MIN_TEAM_CROSSCHECK_SCORE) {
    return {
      ok: false,
      reason: "fixture_book_team_mismatch",
      flags: [RELIABILITY_UNRELIABLE_MATCH],
    };
  }

  const kick = new Date(m.utcDate).getTime();
  const msToKick = kick - nowMs;
  if (msToKick > 0 && msToKick < NEAR_KICKOFF_WINDOW_MS && mq < MIN_ODDS_MATCH_SCORE_NEAR_KICKOFF) {
    return {
      ok: false,
      reason: "odds_alignment_below_threshold_near_kickoff",
      flags: [RELIABILITY_UNRELIABLE_MATCH, RELIABILITY_LOW_DATA_QUALITY],
    };
  }

  return { ok: true };
}

export function reliabilityFlagsForInsufficientReason(reason: string): string[] {
  switch (reason) {
    case "odds_missing":
      return [RELIABILITY_UNRELIABLE_MATCH];
    case "odds_invalid":
      return [RELIABILITY_UNRELIABLE_MATCH];
    case "odds_unmatched_or_low_confidence":
      return [RELIABILITY_UNRELIABLE_MATCH, RELIABILITY_LOW_DATA_QUALITY];
    case "odds_feed_unavailable":
      return [RELIABILITY_UNRELIABLE_MATCH];
    case "fixture_book_team_mismatch":
    case "fixture_book_team_names_missing":
      return [RELIABILITY_UNRELIABLE_MATCH];
    case "odds_alignment_below_threshold":
    case "odds_alignment_below_threshold_near_kickoff":
      return [RELIABILITY_UNRELIABLE_MATCH, RELIABILITY_LOW_DATA_QUALITY];
    default:
      return [RELIABILITY_UNRELIABLE_MATCH];
  }
}
