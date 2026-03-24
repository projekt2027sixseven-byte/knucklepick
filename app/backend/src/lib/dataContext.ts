import { loadEnv } from "../../../config/env";

/** Safe, non-secret flags for UI trust messaging (fixtures/odds pipeline posture). */
export type DataContextPublic = {
  mockDataMode: boolean;
  footballApiConfigured: boolean;
  oddsApiConfigured: boolean;
  /** True when odds are synthetic or demo-forced (matches `Prediction.mockContext` labeling in pipeline). */
  syntheticOddsPath: boolean;
  /** True when football feed is missing or demo-forced. */
  syntheticFootballPath: boolean;
  /** Both API keys set and demo mode off — production-style data path. */
  liveIntegrations: boolean;
};

export function getDataContextPublic(): DataContextPublic {
  const env = loadEnv();
  const footballApiConfigured = Boolean(env.FOOTBALL_API_KEY?.trim());
  const oddsApiConfigured = Boolean(env.ODDS_API_KEY?.trim());
  const mockDataMode = Boolean(env.MOCK_DATA_MODE);
  const syntheticOddsPath = mockDataMode || !oddsApiConfigured;
  const syntheticFootballPath = mockDataMode || !footballApiConfigured;
  const liveIntegrations = footballApiConfigured && oddsApiConfigured && !mockDataMode;
  return {
    mockDataMode,
    footballApiConfigured,
    oddsApiConfigured,
    syntheticOddsPath,
    syntheticFootballPath,
    liveIntegrations,
  };
}
