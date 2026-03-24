/** Max fixtures in the “Top edges” decision hero (3–5). */
export const TOP_EDGES_DECISION_COUNT = 5;

/**
 * Edge labels use max(model − implied) across 1X2 in **probability mass** (0–1).
 * e.g. 0.045 → model is 4.5pp richer than market on the best-aligned outcome.
 */
export const EDGE_HIGH_MIN_PROB = 0.045;
export const EDGE_MEDIUM_MIN_PROB = 0.028;

/** Decision rails: require “strong signal” plus MEDIUM+ edge (see edgeDetection.surfaceEligible). */
export const MIN_CONFIDENCE_STRONG_SIGNAL = 0.5;
export const MIN_TRUST_STRONG_SIGNAL = 44;

/** Legacy pick-based floor — superseded by edgeLabel + surfaceEligible for rails. Kept for avoid/weak heuristics. */
export const MIN_EDGE_ON_PICK_TOP = 0.025;
/** Stricter floor for value picks (max-edge probability mass). */
export const MIN_EDGE_ON_PICK_VALUE = 0.038;

/** Below this headline confidence, a fixture is “low confidence” for the avoid lane (when not NO BET). */
export const LOW_CONFIDENCE_THRESHOLD = 0.46;

/** Short copy when trapMatch is true (mirrors trap detection intent). */
export const TRAP_BRIEF_DEFAULT =
  "Crowded market price vs weaker model conviction — possible mispriced favorite or information skew. Tread carefully.";
