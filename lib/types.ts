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

export interface PlayerStat {
  playerName: string;
  teamAbbr: string;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  steals: number;
  blocks: number;
  turnovers: number;
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
  playerStat?: PlayerStat;
  currentStatValue?: number | null;
  targetStatValue?: number | null;
  statLabel?: string | null;
  // Persisted final data from DB
  finalStatValue?: number | null;
  gameHomeTeam?: string | null;
  gameAwayTeam?: string | null;
  gameHomeScore?: number | null;
  gameAwayScore?: number | null;
  gamePeriod?: string | null;
  gameCompleted?: boolean | null;
}

export interface ParsedLeg {
  player: string;
  team: string;
  opponent: string;
  betType: string;
  line: string;
  stat: string | null;
  odds: number;
  confidence: number;
  gameDate: string | null;
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
