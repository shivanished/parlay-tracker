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
  active: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  won: "bg-positive/20 text-positive border-positive/40",
  lost: "bg-negative/20 text-negative border-negative/40",
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

      <div className="flex items-center justify-between bg-surface rounded-lg p-4 border border-border/50">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Total Odds</div>
          <div className="text-xl font-bold font-mono tabular-nums">{oddsStr}</div>
        </div>
        {parlay.wagerAmount && (
          <>
            <div className="space-y-1 text-center">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Wager</div>
              <div className="text-xl font-bold font-mono tabular-nums">${parlay.wagerAmount}</div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Payout</div>
              <div className="text-xl font-bold text-positive font-mono tabular-nums">
                ${parlay.potentialPayout?.toFixed(2)}
              </div>
            </div>
          </>
        )}
        <div className="flex flex-col items-center">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Hit Probability</div>
          <ProbabilityGauge probability={prob} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Legs</h2>
        {gameGroups.map((group) => (
          <div key={group.key} className="border border-border/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border/50">
              <span className="font-semibold text-sm">{group.label}</span>
              {group.score && (
                <LiveScore score={group.score} />
              )}
            </div>
            <div className="divide-y divide-border/30">
              {group.legs.map((leg) => (
                <div key={leg.id} className="px-2 py-1">
                  <LegRow leg={leg} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border/50">
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
