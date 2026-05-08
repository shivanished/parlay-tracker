import { BetType, LegStatus, GameScore, PlayerStat } from "./types";

// Map common stat keywords from bet lines to PlayerStat fields
const STAT_MAP: Record<string, keyof PlayerStat> = {
  points: "points",
  pts: "points",
  point: "points",
  rebounds: "rebounds",
  rebs: "rebounds",
  reb: "rebounds",
  rebound: "rebounds",
  assists: "assists",
  ast: "assists",
  assist: "assists",
  threes: "threes",
  "three": "threes",
  "3pm": "threes",
  "3pt": "threes",
  "three pointers": "threes",
  "three-pointers": "threes",
  steals: "steals",
  stl: "steals",
  steal: "steals",
  blocks: "blocks",
  blk: "blocks",
  block: "blocks",
  turnovers: "turnovers",
  to: "turnovers",
  turnover: "turnovers",
};

export function parseStatFromLine(line: string): { target: number; statKey: keyof PlayerStat | null } {
  // Patterns: "1+ threes", "15+ points", "4+ rebounds"
  const match = line.match(/(\d+\.?\d*)\+?\s+(.+)/i);
  if (!match) return { target: 0, statKey: null };

  const target = parseFloat(match[1]);
  const statWord = match[2].trim().toLowerCase();
  const statKey = STAT_MAP[statWord] || null;

  return { target, statKey };
}

export function evaluateProp(
  line: string,
  playerStat: PlayerStat | undefined,
  gameComplete: boolean
): { status: LegStatus; currentValue: number; target: number; statLabel: string } {
  const { target, statKey } = parseStatFromLine(line);

  if (!statKey || !playerStat) {
    return { status: "pending", currentValue: 0, target, statLabel: line };
  }

  const currentValue = playerStat[statKey] as number;
  const hitting = currentValue >= target;

  let status: LegStatus;
  if (hitting) {
    status = gameComplete ? "won" : "winning";
  } else {
    status = gameComplete ? "lost" : "losing";
  }

  return { status, currentValue, target, statLabel: statKey };
}

export function evaluateLeg(
  betType: BetType,
  line: string,
  teamAbbr: string,
  score: GameScore,
  playerStat?: PlayerStat
): LegStatus {
  if (!score.isLive && !score.isComplete) return "pending";

  const isHome = score.homeTeam === teamAbbr;
  const teamScore = isHome ? score.homeScore : score.awayScore;
  const oppScore = isHome ? score.awayScore : score.homeScore;
  const totalScore = score.homeScore + score.awayScore;

  const status = score.isComplete ? "final" : "live";

  switch (betType) {
    case "spread": {
      const spread = parseFloat(line);
      if (isNaN(spread)) return "pending";
      const margin = teamScore - oppScore + spread;
      if (margin === 0) return status === "final" ? "push" : "pending";
      const covering = margin > 0;
      return status === "final"
        ? covering ? "won" : "lost"
        : covering ? "winning" : "losing";
    }

    case "moneyline": {
      if (teamScore === oppScore) {
        return status === "final" ? "push" : "pending";
      }
      const winning = teamScore > oppScore;
      return status === "final"
        ? winning ? "won" : "lost"
        : winning ? "winning" : "losing";
    }

    case "over_under": {
      const normalized = line.toUpperCase().trim();
      const isOver = normalized.startsWith("O");
      const target = parseFloat(normalized.replace(/^[OU]\s*/, ""));
      if (isNaN(target)) return "pending";

      if (totalScore === target) {
        return status === "final" ? "push" : "pending";
      }
      const hitting = isOver ? totalScore > target : totalScore < target;
      return status === "final"
        ? hitting ? "won" : "lost"
        : hitting ? "winning" : "losing";
    }

    case "prop": {
      if (!playerStat) return "pending";
      const { status: propStatus } = evaluateProp(line, playerStat, score.isComplete);
      return propStatus;
    }

    default:
      return "pending";
  }
}
