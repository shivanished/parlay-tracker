"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameScore, LegWithScore, PlayerStat } from "@/lib/types";
import { evaluateLeg, evaluateProp } from "@/lib/bet-evaluator";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { BetType } from "@/lib/types";

function extractPlayerName(team: string): string | null {
  // Format: "Cade Cunningham (Detroit Pistons)" → "Cade Cunningham"
  const match = team.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : null;
}

export function useLiveScores(
  legs: LegWithScore[],
  enabled: boolean = true
) {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat[]>>({});
  const [updatedLegs, setUpdatedLegs] = useState<LegWithScore[]>(legs);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  const fetchPlayerStats = useCallback(async (eventIds: string[]) => {
    if (eventIds.length === 0) return;
    try {
      const res = await fetch(`/api/player-stats?eventIds=${eventIds.join(",")}`);
      if (!res.ok) return;
      const data: Record<string, PlayerStat[]> = await res.json();
      setPlayerStats(data);
    } catch {
      // silent fail
    }
  }, []);

  // Fetch scores + player stats
  const fetchAll = useCallback(async () => {
    const scoresRes = await fetch("/api/scores").catch(() => null);
    let latestScores: GameScore[] = [];
    if (scoresRes?.ok) {
      latestScores = await scoresRes.json();
      setScores(latestScores);
    }

    // Collect event IDs for all prop legs — from espnEventId or by matching scores
    const eventIds = new Set<string>();
    for (const leg of legs) {
      if (leg.betType !== "prop") continue;
      if (leg.espnEventId) {
        eventIds.add(leg.espnEventId);
      } else {
        const teamAbbr = resolveTeamAbbr(leg.team);
        if (teamAbbr) {
          const game = latestScores.find(
            (s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr
          );
          if (game) eventIds.add(game.espnEventId);
        }
      }
    }

    if (eventIds.size > 0) {
      await fetchPlayerStats([...eventIds]);
    }
  }, [fetchPlayerStats, legs]);

  // Update leg statuses when scores/stats change
  useEffect(() => {
    if (scores.length === 0) {
      setUpdatedLegs(legs);
      return;
    }

    const availableTeams = scores.flatMap((s) => [s.homeTeam, s.awayTeam]);

    const updated = legs.map((leg) => {
      const teamAbbr = resolveTeamAbbr(leg.team);
      if (!teamAbbr) {
        console.warn(`[live] No team abbr for: "${leg.team}"`);
        return leg;
      }

      const game = scores.find(
        (s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr
      );
      if (!game) {
        console.warn(`[live] No game for ${teamAbbr} (from "${leg.team}"). Available: ${availableTeams.join(", ")}`);
        return leg;
      }

      // Don't override final statuses from DB
      if (leg.status === "won" || leg.status === "lost" || leg.status === "push") {
        return { ...leg, score: game };
      }

      // For props, find player stat
      if (leg.betType === "prop") {
        const playerName = extractPlayerName(leg.team);
        const eventId = leg.espnEventId || game.espnEventId;
        const eventPlayers = playerStats[eventId] || [];
        const stat = playerName
          ? eventPlayers.find(
              (p) => p.playerName.toLowerCase() === playerName.toLowerCase()
            )
          : undefined;

        if (!stat && playerName) {
          const available = eventPlayers.map((p) => p.playerName).join(", ");
          console.warn(`[live] Player "${playerName}" not found in event ${eventId}. Players: ${available || "none loaded"}`);
        }

        const { status: propStatus, currentValue, target, statLabel } = evaluateProp(
          leg.line,
          stat,
          game.isComplete
        );

        return {
          ...leg,
          score: game,
          status: stat ? propStatus : (game.isComplete ? "lost" : "pending"),
          playerStat: stat,
          currentStatValue: currentValue,
          targetStatValue: target,
          statLabel,
        };
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
  }, [scores, playerStats, legs]);

  // Polling
  useEffect(() => {
    if (!enabled) return;

    fetchAll();

    const hasLiveGames = scoresRef.current.some((s) => s.isLive);
    const interval = hasLiveGames ? 30000 : 120000;

    const timer = setInterval(fetchAll, interval);
    return () => clearInterval(timer);
  }, [enabled, fetchAll]);

  return { scores, legs: updatedLegs };
}
