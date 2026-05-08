export type Sport = "basketball";
export type League = "NBA";
export type BetType = "spread" | "moneyline" | "over_under" | "prop";
export type LegStatus = "pending" | "winning" | "losing" | "won" | "lost" | "push";
export type ParlayStatus = "active" | "won" | "lost";

export interface GameScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: string;
  clock: string;
  isLive: boolean;
  isComplete: boolean;
  espnEventId: string;
}

export interface LegWithScore {
  id: string;
  parlayId: string;
  team: string;
  opponent: string;
  league: string;
  betType: BetType;
  line: string;
  odds: number;
  status: LegStatus;
  espnEventId: string | null;
  score?: GameScore;
}

export interface ParlayWithLegs {
  id: string;
  createdAt: string;
  status: ParlayStatus;
  wagerAmount: number | null;
  totalOdds: number | null;
  potentialPayout: number | null;
  screenshotUrl: string | null;
  legs: LegWithScore[];
}
