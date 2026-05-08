import { BetType, LegStatus, GameScore } from "./types";

export function evaluateLeg(
  betType: BetType,
  line: string,
  teamAbbr: string,
  score: GameScore
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

    case "prop":
      // Props can't be auto-evaluated without specific stat data
      return "pending";

    default:
      return "pending";
  }
}
