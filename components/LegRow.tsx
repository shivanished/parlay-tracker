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

  const isProp = leg.betType === "prop";
  const hasStatProgress =
    isProp &&
    leg.currentStatValue !== undefined &&
    leg.targetStatValue !== undefined;

  return (
    <div
      className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
        leg.status === "won"
          ? "border-green-300 bg-green-50/50"
          : leg.status === "lost"
            ? "border-red-300 bg-red-50/50"
            : leg.status === "winning"
              ? "border-green-200"
              : leg.status === "losing"
                ? "border-red-200"
                : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">
          {leg.team}
        </div>
        {leg.opponent && (
          <div className="text-xs text-muted-foreground">
            vs {leg.opponent}
          </div>
        )}
        <div className="text-sm text-muted-foreground mt-0.5">
          {betTypeLabels[leg.betType] || leg.betType} {leg.line}{" "}
          <span className="font-mono">({oddsStr})</span>
        </div>

        {hasStatProgress && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-bold text-lg">
                {leg.currentStatValue}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">
                {leg.targetStatValue} {leg.statLabel}
              </span>
              {leg.currentStatValue! >= leg.targetStatValue! ? (
                <span className="text-green-600 font-semibold text-xs">HIT</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  need {leg.targetStatValue! - leg.currentStatValue!} more
                </span>
              )}
            </div>
            <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  leg.currentStatValue! >= leg.targetStatValue!
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (leg.currentStatValue! / leg.targetStatValue!) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
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
