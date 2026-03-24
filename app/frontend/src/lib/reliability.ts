/** Machine reasons from backend `Match.insufficientDataReason` */
export const insufficientDataUserMessage: Record<string, string> = {
  odds_missing: "No usable odds were linked to this fixture.",
  odds_invalid: "Odds failed numeric validation.",
  odds_unmatched_or_low_confidence:
    "Book odds could not be aligned to this fixture with enough confidence (or pairing was ambiguous).",
  odds_feed_unavailable: "Odds feed unavailable — predictions stay off until the feed recovers.",
  fixture_book_team_mismatch: "Book event teams did not match this fixture after validation.",
  fixture_book_team_names_missing: "Book event was missing team labels needed for a safe cross-check.",
  odds_alignment_below_threshold: "Fixture–book alignment was below the safety threshold.",
  odds_alignment_below_threshold_near_kickoff:
    "Alignment was too weak this close to kickoff — withheld until confidence improves.",
};

export function messageForInsufficientReason(reason: string | null | undefined): string {
  if (!reason) return "Data quality checks did not pass — no prediction was generated.";
  return insufficientDataUserMessage[reason] ?? `Data checks failed (${reason}).`;
}

export const RELIABILITY_LABELS: Record<string, string> = {
  UNRELIABLE_MATCH: "Unreliable match",
  LOW_DATA_QUALITY: "Low data quality",
};
