"use client";

import { GameScore } from "@/lib/types";

export function LiveScore({ score }: { score: GameScore }) {
  return (
    <div className="text-sm font-mono bg-surface rounded-md px-2 py-1 border border-border/30">
      <div className="flex justify-between gap-4">
        <span>{score.awayTeam}</span>
        <span className="font-bold tabular-nums">{score.awayScore}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>{score.homeTeam}</span>
        <span className="font-bold tabular-nums">{score.homeScore}</span>
      </div>
      <div className="text-xs text-muted-foreground text-center mt-1">
        {score.isComplete ? (
          "Final"
        ) : score.isLive ? (
          <span className="text-positive flex items-center justify-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            {score.period} {score.clock}
          </span>
        ) : (
          "Scheduled"
        )}
      </div>
    </div>
  );
}
