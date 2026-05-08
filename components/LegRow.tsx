"use client";

import { LegWithScore } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { LiveScore } from "./LiveScore";

const betTypeLabels: Record<string, string> = {
  spread: "Spread",
  moneyline: "ML",
  over_under: "O/U",
  prop: "Prop",
};

export function LegRow({ leg }: { leg: LegWithScore }) {
  const oddsStr =
    leg.odds > 0 ? `+${leg.odds}` : String(leg.odds);

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="font-semibold">
          {leg.team} vs {leg.opponent}
        </div>
        <div className="text-sm text-muted-foreground">
          {betTypeLabels[leg.betType] || leg.betType} {leg.line}{" "}
          <span className="font-mono">({oddsStr})</span>
        </div>
      </div>

      {leg.score && (
        <div className="shrink-0">
          <LiveScore score={leg.score} />
        </div>
      )}

      <div className="shrink-0">
        <StatusBadge status={leg.status} />
      </div>
    </div>
  );
}
