/** Mirrors GET /api/meta/data-context — integration posture for trust UI. */
export type DataContextPublic = {
  mockDataMode: boolean;
  footballApiConfigured: boolean;
  oddsApiConfigured: boolean;
  syntheticOddsPath: boolean;
  syntheticFootballPath: boolean;
  liveIntegrations: boolean;
};
