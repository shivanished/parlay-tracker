"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParlayWithLegs } from "@/lib/types";
import { parlayProbability } from "@/lib/probability";

const statusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  won: "bg-green-500 text-white",
  lost: "bg-red-500 text-white",
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
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
                      ? "text-green-600"
                      : leg.status === "lost" || leg.status === "losing"
                        ? "text-red-600"
                        : ""
                  }
                >
                  {leg.status}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t text-sm">
            <div>
              <span className="text-muted-foreground">Odds: </span>
              <span className="font-mono font-semibold">{oddsStr}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hitting: </span>
              <span className="font-semibold">{wonLegs}/{parlay.legs.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Prob: </span>
              <span className="font-semibold">{pct}%</span>
            </div>
          </div>

          {parlay.wagerAmount && (
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-muted-foreground">
                Wager: ${parlay.wagerAmount}
              </span>
              <span className="font-semibold text-green-600">
                Payout: ${parlay.potentialPayout?.toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
