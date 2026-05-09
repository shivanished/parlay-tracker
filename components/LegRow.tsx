"use client";

import { LegWithScore } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export function LegRow({ leg }: { leg: LegWithScore }) {
  const oddsStr =
    leg.odds > 0 ? `+${leg.odds}` : String(leg.odds);

  const isProp = leg.betType === "prop";
  const hasStatProgress =
    isProp &&
    leg.currentStatValue != null &&
    leg.targetStatValue != null;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        leg.status === "won"
          ? "bg-positive-muted"
          : leg.status === "lost"
            ? "bg-negative-muted"
            : leg.status === "winning"
              ? "bg-positive-muted/50"
              : leg.status === "losing"
                ? "bg-negative-muted/50"
                : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">
          {leg.team}
        </div>

        {hasStatProgress ? (
          <div className="mt-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono font-bold text-lg tabular-nums">
                {leg.currentStatValue}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">
                {leg.targetStatValue} {leg.statLabel}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                ({oddsStr})
              </span>
              {leg.currentStatValue! >= leg.targetStatValue! ? (
                <span className="text-positive font-semibold text-xs">HIT</span>
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
                    ? "bg-positive"
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
        ) : (
          <div className="text-sm text-muted-foreground">
            {leg.line}{" "}
            <span className="font-mono tabular-nums">({oddsStr})</span>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <StatusBadge status={leg.status} />
      </div>
    </div>
  );
}
