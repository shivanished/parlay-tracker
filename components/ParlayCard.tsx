"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParlayWithLegs } from "@/lib/types";
import { parlayProbability } from "@/lib/probability";

const statusColors: Record<string, string> = {
  active: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  won: "bg-positive/20 text-positive border-positive/40",
  lost: "bg-negative/20 text-negative border-negative/40",
};

export function ParlayCard({ parlay }: { parlay: ParlayWithLegs }) {
  const prob = parlayProbability(parlay.legs);
  const pct = Math.round(prob * 100);
  const wonLegs = parlay.legs.filter(
    (l) => l.status === "won" || l.status === "winning"
  ).length;

  const oddsStr = parlay.totalOdds
    ? parlay.totalOdds > 0
      ? `+${parlay.totalOdds}`
      : String(parlay.totalOdds)
    : "—";

  return (
    <Link href={`/parlay/${parlay.id}`}>
      <Card className="hover:bg-surface-hover transition-colors cursor-pointer border-border/50 hover:border-border">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base">
              {parlay.legs.length}-Leg Parlay
            </CardTitle>
            <Badge
              variant="outline"
              className={statusColors[parlay.status] || ""}
            >
              {parlay.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm text-muted-foreground">
            {parlay.legs.map((leg) => (
              <div key={leg.id} className="flex justify-between">
                <span className="truncate">
                  {leg.team} ({leg.betType === "moneyline" ? "ML" : leg.line})
                </span>
                <span
                  className={
                    leg.status === "won" || leg.status === "winning"
                      ? "text-positive"
                      : leg.status === "lost" || leg.status === "losing"
                        ? "text-negative"
                        : ""
                  }
                >
                  {leg.status}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50 text-sm">
            <div>
              <span className="text-muted-foreground">Odds </span>
              <span className="font-mono font-semibold tabular-nums">{oddsStr}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hitting </span>
              <span className="font-mono font-semibold tabular-nums">{wonLegs}/{parlay.legs.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Prob </span>
              <span className="font-mono font-semibold tabular-nums">{pct}%</span>
            </div>
          </div>

          {parlay.wagerAmount && (
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-muted-foreground font-mono tabular-nums">
                Wager: ${parlay.wagerAmount}
              </span>
              <span className="font-semibold text-positive font-mono tabular-nums">
                Payout: ${parlay.potentialPayout?.toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
