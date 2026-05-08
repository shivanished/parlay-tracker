"use client";

import { GameScore } from "@/lib/types";

export function LiveScore({ score }: { score: GameScore }) {
  return (
    <div className="text-sm font-mono bg-muted rounded px-2 py-1">
      <div className="flex justify-between gap-4">
        <span>{score.awayTeam}</span>
        <span className="font-bold">{score.awayScore}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>{score.homeTeam}</span>
        <span className="font-bold">{score.homeScore}</span>
      </div>
      <div className="text-xs text-muted-foreground text-center mt-1">
        {score.isComplete ? (
          "Final"
        ) : score.isLive ? (
          <span className="text-green-600">
            {score.period} {score.clock}
          </span>
        ) : (
          "Scheduled"
        )}
      </div>
    </div>
  );
}
