import type { EngineWeights } from "./weights";
import { blendLambdas, empiricalLambdasFromRolling, type RollingForLambda } from "./empiricalRatings";
import { buildMatchFeatureVector } from "./matchFeatures";
import { expectedGoalsFromFeatures, type GoalExpectationOutput } from "./teamStrengthModel";
import { clamp } from "../utils/math";
import { inferLambdaTotalFromOver25 } from "../utils/ouInference";

/** @deprecated Use GoalExpectationOutput from teamStrengthModel — kept for gradual refactors. */
export type GoalInputs = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeFormPts: number;
  awayFormPts: number;
  homeXG: number;
  awayXG: number;
  homeGoalsAgainstAvg: number;
  awayGoalsAgainstAvg: number;
  impliedHome: number;
  impliedAway: number;
  weights: EngineWeights;
  hasStats?: boolean;
  mockData?: boolean;
  strengthGap?: number;
  restDaysHome?: number;
  restDaysAway?: number;
  leagueStrengthIndex?: number;
  rolling?: RollingForLambda | null;
  empiricalBlend?: number;
  /** When both set, total expected goals are softly anchored to de-vigged O/U 2.5. */
  over25?: number;
  under25?: number;
};

/**
 * Poisson rate estimation: attack/defense decomposition + home-advantage on log scale,
 * anchored to a league baseline expected total goals.
 */
export function expectedGoalsModel(input: GoalInputs): GoalExpectationOutput {
  const fv = buildMatchFeatureVector({
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
    homeFormPts: input.homeFormPts,
    awayFormPts: input.awayFormPts,
    homeXG: input.homeXG,
    awayXG: input.awayXG,
    homeGoalsAgainstAvg: input.homeGoalsAgainstAvg,
    awayGoalsAgainstAvg: input.awayGoalsAgainstAvg,
    strengthGap: input.strengthGap ?? input.homeFormPts - input.awayFormPts,
    hasStats: input.hasStats ?? true,
    mockData: input.mockData ?? false,
    weights: input.weights,
    restDaysHome: input.restDaysHome,
    restDaysAway: input.restDaysAway,
    leagueStrengthIndex: input.leagueStrengthIndex,
  });
  const base = expectedGoalsFromFeatures(fv);
  const w = input.empiricalBlend ?? 0;
  let lambdas = { lambdaHome: base.lambdaHome, lambdaAway: base.lambdaAway };
  if (input.rolling && w > 0) {
    const emp = empiricalLambdasFromRolling(input.rolling, fv, base.baseline, fv.restDaysHome, fv.restDaysAway);
    lambdas = blendLambdas(base, emp, w);
  }
  let out: GoalExpectationOutput = {
    ...base,
    lambdaHome: lambdas.lambdaHome,
    lambdaAway: lambdas.lambdaAway,
  };
  const targetSum =
    input.over25 && input.under25 ? inferLambdaTotalFromOver25(input.over25, input.under25) : null;
  if (targetSum != null) {
    const cur = out.lambdaHome + out.lambdaAway;
    const scale = clamp(targetSum / cur, 0.82, 1.18);
    out = {
      ...out,
      lambdaHome: clamp(out.lambdaHome * scale, 0.35, 4.2),
      lambdaAway: clamp(out.lambdaAway * scale, 0.35, 4.2),
    };
  }
  return out;
}
