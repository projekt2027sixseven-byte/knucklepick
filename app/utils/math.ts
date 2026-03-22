export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function impliedProbabilities(odds1: number, oddsX: number, odds2: number): {
  home: number;
  draw: number;
  away: number;
} {
  const inv = [1 / odds1, 1 / oddsX, 1 / odds2];
  const sum = inv.reduce((a, b) => a + b, 0);
  return { home: inv[0] / sum, draw: inv[1] / sum, away: inv[2] / sum };
}

export function poissonPmf(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function poissonScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 6
): { home: number; away: number; p: number }[] {
  const out: { home: number; away: number; p: number }[] = [];
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      out.push({ home: h, away: a, p });
    }
  }
  out.sort((x, y) => y.p - x.p);
  return out;
}

/**
 * Dixon–Coles τ adjustment for low-score dependence (draw / 0–0 inflation).
 * ρ is typically small (≈0.03–0.15). See Dixon & Coles (1997).
 */
export function tauDixonColes(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h > 1 || a > 1) return 1;
  if (h === 0 && a === 0) return Math.max(0.12, 1 - lh * la * rho);
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 1) return Math.max(0.12, 1 - rho);
  return 1;
}

export function defaultDixonColesRho(lambdaHome: number, lambdaAway: number): number {
  const mu = lambdaHome + lambdaAway;
  return clamp(0.11 - 0.025 * (mu - 2.5), 0.03, 0.14);
}

export function poissonScoreMatrixDC(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number,
  rho: number
): { home: number; away: number; p: number }[] {
  const cells: { home: number; away: number; p: number }[] = [];
  let sum = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      let p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      p *= tauDixonColes(h, a, lambdaHome, lambdaAway, rho);
      cells.push({ home: h, away: a, p });
      sum += p;
    }
  }
  for (const c of cells) {
    c.p /= sum;
  }
  cells.sort((x, y) => y.p - x.p);
  return cells;
}

/** P(both score) under independence conditional on Poisson rates. */
export function bttsProbability(lambdaHome: number, lambdaAway: number): number {
  return (1 - Math.exp(-lambdaHome)) * (1 - Math.exp(-lambdaAway));
}

/** P(total goals > line) for half-integer line using convolution of Poisson totals. */
export function overGoalsProbability(lambdaHome: number, lambdaAway: number, line: number): number {
  const maxK = 14;
  const pTotal: number[] = new Array(maxK + 1).fill(0);
  for (let h = 0; h <= maxK; h++) {
    for (let a = 0; a <= maxK; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      if (h + a <= maxK) pTotal[h + a] += p;
    }
  }
  let cum = 0;
  for (let g = 0; g <= Math.floor(line); g++) {
    cum += pTotal[g] ?? 0;
  }
  return clamp(1 - cum, 0, 1);
}

export function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
}
