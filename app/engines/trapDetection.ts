export type TrapResult = { isTrap: boolean; reason?: string };

export function detectTrap(
  marketMaxProb: number,
  modelConfidence: number,
  disagreementL1: number
): TrapResult {
  if (marketMaxProb > 0.52 && modelConfidence < 0.42) {
    return {
      isTrap: true,
      reason:
        "Market is heavily skewed while the model remains uncertain — possible mispriced favorite or information asymmetry.",
    };
  }
  if (marketMaxProb > 0.48 && modelConfidence < 0.38 && disagreementL1 > 0.35) {
    return {
      isTrap: true,
      reason: "Wide model–market disagreement on a one-sided price — treat as high structural risk.",
    };
  }
  return { isTrap: false };
}
