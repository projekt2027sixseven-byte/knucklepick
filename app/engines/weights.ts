export type EngineWeights = {
  form: number;
  xg: number;
  odds: number;
  defense: number;
  similarity: number;
  market: number;
};

const DEFAULTS: EngineWeights = {
  form: 0.22,
  xg: 0.28,
  odds: 0.2,
  defense: 0.18,
  similarity: 0.22,
  market: 0.2,
};

export function defaultEngineWeights(): EngineWeights {
  return { ...DEFAULTS };
}

export async function resolveEngineWeights(
  getDbWeight: (key: string) => Promise<number | null>
): Promise<EngineWeights> {
  const keys = Object.keys(DEFAULTS) as (keyof EngineWeights)[];
  const out = { ...DEFAULTS };
  for (const k of keys) {
    const v = await getDbWeight(`weight_${k}`);
    if (v != null && !Number.isNaN(v)) out[k] = v;
  }
  return out;
}
