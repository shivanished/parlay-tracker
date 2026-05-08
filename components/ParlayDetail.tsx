"use client";

import { ParlayWithLegs, LegWithScore, GameScore } from "@/lib/types";
import { useLiveScores } from "@/hooks/useLiveScores";
import { parlayProbability } from "@/lib/probability";
import { LegRow } from "./LegRow";
import { LiveScore } from "./LiveScore";
import { ProbabilityGauge } from "./ProbabilityGauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

const statusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  won: "bg-green-500 text-white",
  lost: "bg-red-500 text-white",
};

interface GameGroup {
  key: string;
  score: GameScore | undefined;
  label: string;
  legs: LegWithScore[];
}

function groupLegsByGame(legs: LegWithScore[]): GameGroup[] {
  const groups = new Map<string, GameGroup>();

  for (const leg of legs) {
    // Group by espnEventId if available, else by score's eventId, else "unmatched"
    const eventId = leg.espnEventId || leg.score?.espnEventId || "unmatched";

    if (!groups.has(eventId)) {
      const score = leg.score;
      const label = score
        ? `${score.awayTeam} @ ${score.homeTeam}`
        : "Unknown Game";

      groups.set(eventId, { key: eventId, score, label, legs: [] });
    }

    const group = groups.get(eventId)!;
    group.legs.push(leg);
    // Update score if this leg has one and group doesn't yet
    if (leg.score && !group.score) {
      group.score = leg.score;
      group.label = `${leg.score.awayTeam} @ ${leg.score.homeTeam}`;
    }
  }

  return Array.from(groups.values());
}

export function ParlayDetail({ parlay }: { parlay: ParlayWithLegs }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { legs } = useLiveScores(parlay.legs, true, parlay.createdAt, parlay.id, parlay.status);
  const prob = parlayProbability(legs);

  const oddsStr = parlay.totalOdds
    ? parlay.totalOdds > 0
      ? `+${parlay.totalOdds}`
      : String(parlay.totalOdds)
    : "—";

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/parlays/${parlay.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const allResolved = legs.every(
    (l) => l.status === "won" || l.status === "lost" || l.status === "push"
  );
  const anyLost = legs.some((l) => l.status === "lost");
  const derivedStatus = allResolved
    ? anyLost
      ? "lost"
      : "won"
    : parlay.status;

  const gameGroups = groupLegsByGame(legs);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {parlay.legs.length}-Leg Parlay
          </h1>
          <p className="text-sm text-muted-foreground">
            Created {new Date(parlay.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-sm ${statusColors[derivedStatus] || ""}`}
        >
          {derivedStatus}
        </Badge>
      </div>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Total Odds</div>
          <div className="text-xl font-bold font-mono">{oddsStr}</div>
        </div>
        {parlay.wagerAmount && (
          <>
            <div className="space-y-1 text-center">
              <div className="text-sm text-muted-foreground">Wager</div>
              <div className="text-xl font-bold">${parlay.wagerAmount}</div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-sm text-muted-foreground">Payout</div>
              <div className="text-xl font-bold text-green-600">
                ${parlay.potentialPayout?.toFixed(2)}
              </div>
            </div>
          </>
        )}
        <div className="flex flex-col items-center">
          <div className="text-sm text-muted-foreground mb-1">Hit Probability</div>
          <ProbabilityGauge probability={prob} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold">Legs</h2>
        {gameGroups.map((group) => (
          <div key={group.key} className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
              <span className="font-semibold text-sm">{group.label}</span>
              {group.score && (
                <LiveScore score={group.score} />
              )}
            </div>
            <div className="divide-y">
              {group.legs.map((leg) => (
                <div key={leg.id} className="px-2 py-1">
                  <LegRow leg={leg} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete Parlay"}
        </Button>
      </div>
    </div>
  );
}
