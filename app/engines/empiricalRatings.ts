import { clamp } from "../utils/math";
import type { TeamStrength } from "./teamStrengthModel";
import { homeAdvantageLambda, lambdasFromStrengths } from "./teamStrengthModel";
import type { MatchFeatureVector } from "./matchFeatures";

export type RollingForLambda = {
  homeGF: number;
  homeGA: number;
  awayGF: number;
  awayGA: number;
  nHome: number;
  nAway: number;
  leagueAvgGoalsPerGame: number;
};

/**
 * Map rolling goals for/against (per game) to attack/defense components compatible with
 * lambdasFromStrengths, using log-ratios vs league-average half-goals (shrunk for small samples).
 */
function strengthsFromGoalRates(
  gf: number,
  ga: number,
  leagueHalf: number,
  shrink: number
): TeamStrength {
  const neutralAtk = 0.45;
  const neutralDef = 0.52;
  const rawAtk = Math.log((gf + 0.28) / (leagueHalf + 0.28));
  const rawDef = Math.log((ga + 0.28) / (leagueHalf + 0.28));
  const atk = clamp(shrink * neutralAtk + (1 - shrink) * (0.55 + rawAtk * 0.85), -0.35, 1.35);
  const def = clamp(shrink * neutralDef + (1 - shrink) * (0.48 + rawDef * 0.82), -0.25, 1.25);
  return { attack: atk, defense: def };
}

export function empiricalLambdasFromRolling(
  rolling: RollingForLambda,
  fv: MatchFeatureVector,
  baseline: number,
  restDaysHome: number,
  restDaysAway: number
): { lambdaHome: number; lambdaAway: number } {
  const half = rolling.leagueAvgGoalsPerGame / 2;
  const n = Math.min(rolling.nHome, rolling.nAway);
  const shrink = clamp(1 - n / 10, 0.12, 0.55);

  const homeS = strengthsFromGoalRates(rolling.homeGF, rolling.homeGA, half, shrink);
  const awayS = strengthsFromGoalRates(rolling.awayGF, rolling.awayGA, half, shrink);
  const ha = homeAdvantageLambda(fv);

  return lambdasFromStrengths(homeS, awayS, ha, baseline, restDaysHome, restDaysAway);
}

export function blendLambdas(
  model: { lambdaHome: number; lambdaAway: number },
  empirical: { lambdaHome: number; lambdaAway: number },
  empiricalWeight: number
): { lambdaHome: number; lambdaAway: number } {
  const w = clamp(empiricalWeight, 0, 1);
  return {
    lambdaHome: (1 - w) * model.lambdaHome + w * empirical.lambdaHome,
    lambdaAway: (1 - w) * model.lambdaAway + w * empirical.lambdaAway,
  };
}
