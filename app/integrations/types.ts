export type NormalizedTeam = {
  externalId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  leagueExternalId?: string;
  leagueName?: string;
  country?: string;
};

export type NormalizedMatch = {
  externalId: string;
  utcDate: string;
  status: string;
  season?: string;
  home: NormalizedTeam;
  away: NormalizedTeam;
  league?: { externalId: string; name: string; country?: string; logoUrl?: string };
  homeScore?: number;
  awayScore?: number;
};

export type NormalizedOdds = {
  matchExternalId: string;
  bookmaker?: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
};

export type NormalizedTeamStats = {
  teamExternalId: string;
  formPointsAvg: number;
  xGFor: number;
  xGAgainst: number;
  goalsForAvg: number;
  goalsAgainstAvg: number;
};

export type HistoricalMatchForSimilarity = {
  externalId: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  strengthGap: number;
  homeForm: number;
  awayForm: number;
  result1x2: "HOME" | "DRAW" | "AWAY";
  totalGoals: number;
  homeGoals: number;
  awayGoals: number;
  btts: boolean;
  over25: boolean;
  scoreLabel: string;
};
