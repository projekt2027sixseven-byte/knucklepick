import type { EngineWeights } from "./weights";
import { blendLambdas, empiricalLambdasFromRolling, type RollingForLambda } from "./empiricalRatings";
import { buildMatchFeatureVector } from "./matchFeatures";
import { expectedGoalsFromFeatures, type GoalExpectationOutput } from "./teamStrengthModel";

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
  if (!input.rolling || w <= 0) return base;
  const emp = empiricalLambdasFromRolling(input.rolling, fv, base.baseline, fv.restDaysHome, fv.restDaysAway);
  const blended = blendLambdas(base, emp, w);
  return {
    ...base,
    lambdaHome: blended.lambdaHome,
    lambdaAway: blended.lambdaAway,
  };
}
