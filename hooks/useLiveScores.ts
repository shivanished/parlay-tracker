"use client";

import { useState, useEffect, useCallback } from "react";
import { GameScore, LegWithScore } from "@/lib/types";
import { evaluateLeg } from "@/lib/bet-evaluator";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { BetType } from "@/lib/types";

export function useLiveScores(
  legs: LegWithScore[],
  enabled: boolean = true
) {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [updatedLegs, setUpdatedLegs] = useState<LegWithScore[]>(legs);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/scores");
      if (!res.ok) return;
      const data: GameScore[] = await res.json();
      setScores(data);
    } catch {
      // silent fail on network errors
    }
  }, []);

  // Update leg statuses when scores change
  useEffect(() => {
    if (scores.length === 0) {
      setUpdatedLegs(legs);
      return;
    }

    const updated = legs.map((leg) => {
      const teamAbbr = resolveTeamAbbr(leg.team);
      if (!teamAbbr) return leg;

      const game = scores.find(
        (s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr
      );
      if (!game) return leg;

      // Don't override final statuses from DB
      if (leg.status === "won" || leg.status === "lost" || leg.status === "push") {
        return { ...leg, score: game };
      }

      const newStatus = evaluateLeg(
        leg.betType as BetType,
        leg.line,
        teamAbbr,
        game
      );

      return { ...leg, score: game, status: newStatus };
    });

    setUpdatedLegs(updated);
  }, [scores, legs]);

  // Polling
  useEffect(() => {
    if (!enabled) return;

    fetchScores();

    const hasLiveGames = scores.some((s) => s.isLive);
    const interval = hasLiveGames ? 30000 : 120000;

    const timer = setInterval(fetchScores, interval);
    return () => clearInterval(timer);
  }, [enabled, fetchScores, scores.some?.length]);

  return { scores, legs: updatedLegs };
}
