import type { ScoreEngineResult } from "./scoreEngine";

export type Scenario = {
  id: string;
  label: string;
  score: string;
  probability: number;
  explanation: string;
};

/**
 * Scenarios are **slices of the same Poisson/Dixon–Coles lattice**, not ad-hoc scores.
 */
export function buildScenarios(
  lattice: ScoreEngineResult,
  lambdaHome: number,
  lambdaAway: number,
  marketFav: "HOME" | "DRAW" | "AWAY"
): Scenario[] {
  const base = lattice.matrix;
  const primary = base[0]!;
  const lowTotal = base.filter((c) => c.home + c.away <= 2).sort((a, b) => b.p - a.p)[0] ?? base[1]!;
  const highTotal = base.filter((c) => c.home + c.away >= 4).sort((a, b) => b.p - a.p)[0] ?? base[2]!;
  const upset =
    marketFav === "HOME"
      ? base.find((c) => c.away > c.home && c.p >= 0.02) ?? base.find((c) => c.away > c.home) ?? base[3]!
      : marketFav === "AWAY"
        ? base.find((c) => c.home > c.away && c.p >= 0.02) ?? base.find((c) => c.home > c.away) ?? base[3]!
        : base.find((c) => c.home !== c.away && c.p >= 0.02) ?? base[3]!;

  const explain = (id: string, cell: { home: number; away: number; p: number }, extra: string) =>
    `${id}: joint mass ${(cell.p * 100).toFixed(1)}% at ${cell.home}-${cell.away}. λ_h=${lambdaHome.toFixed(2)}, λ_a=${lambdaAway.toFixed(2)}. ${extra}`;

  return [
    {
      id: "primary",
      label: "Primary (modal)",
      score: `${primary.home}-${primary.away}`,
      probability: primary.p,
      explanation: explain(
        "Modal",
        primary,
        "Highest-probability scoreline under the fitted Poisson/Dixon–Coles lattice."
      ),
    },
    {
      id: "defensive",
      label: "Low tempo / compact",
      score: `${lowTotal.home}-${lowTotal.away}`,
      probability: lowTotal.p,
      explanation: explain(
        "Low total",
        lowTotal,
        "Emphasizes defensive outcomes within the same distributional fit."
      ),
    },
    {
      id: "high_scoring",
      label: "Open / high conversion",
      score: `${highTotal.home}-${highTotal.away}`,
      probability: highTotal.p,
      explanation: explain(
        "High total",
        highTotal,
        "Tail scenario for elevated goal volume conditional on the same λ estimates."
      ),
    },
    {
      id: "upset",
      label: "Contrarian path",
      score: `${upset.home}-${upset.away}`,
      probability: upset.p,
      explanation: explain(
        "Upset",
        upset,
        "Structured counterfactual vs the market favorite, still drawn from the lattice."
      ),
    },
  ];
}
