"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameScore, LegWithScore, PlayerStat } from "@/lib/types";
import { evaluateLeg, evaluateProp } from "@/lib/bet-evaluator";
import { resolveTeamAbbr } from "@/lib/team-matcher";
import { BetType } from "@/lib/types";

function extractPlayerName(team: string): string | null {
  const match = team.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : null;
}

function toESPNDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getCandidateDates(isoDate: string): string[] {
  const d = new Date(isoDate);
  const dayBefore = new Date(d);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const candidates = new Set<string>();
  candidates.add(toESPNDate(d));
  candidates.add(toESPNDate(dayBefore));
  candidates.add(isoDate.slice(0, 10).replace(/-/g, ""));
  const parts = isoDate.slice(0, 10).split("-").map(Number);
  candidates.add(toESPNDate(new Date(parts[0], parts[1] - 1, parts[2] - 1)));
  return [...candidates];
}

const FINAL_STATUSES = new Set(["won", "lost", "push"]);

interface PlayerLookup {
  teamAbbr: string;
  eventId: string;
  game: GameScore;
  stat: PlayerStat;
}

export function useLiveScores(
  legs: LegWithScore[],
  enabled: boolean = true,
  parlayCreatedAt?: string,
  parlayId?: string,
  parlayStatus?: string
) {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat[]>>({});
  const [updatedLegs, setUpdatedLegs] = useState<LegWithScore[]>(legs);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const finalizedRef = useRef(false);

  const hasRichData = legs.some((l) => l.gameHomeTeam != null);
  const fullyFinalized =
    (parlayStatus === "won" || parlayStatus === "lost") && hasRichData;

  const isToday = !parlayCreatedAt ||
    new Date(parlayCreatedAt).toDateString() === new Date().toDateString();

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

  // Fetch scores for date, then box scores for all games
  const fetchAll = useCallback(async () => {
    let allScores: GameScore[] = [];

    if (isToday) {
      const res = await fetch("/api/scores").catch(() => null);
      if (res?.ok) allScores = await res.json();
    } else if (parlayCreatedAt) {
      // Fetch ALL games for candidate dates
      for (const date of getCandidateDates(parlayCreatedAt)) {
        const res = await fetch(`/api/scores?date=${date}`).catch(() => null);
        if (!res?.ok) continue;
        const dayScores: GameScore[] = await res.json();
        for (const game of dayScores) {
          if (!allScores.some((s) => s.espnEventId === game.espnEventId)) {
            allScores.push(game);
          }
        }
      }
    }

    setScores(allScores);

    // Fetch box scores for ALL games
    const eventIds = allScores.map((s) => s.espnEventId);
    // Also include any espnEventIds stored on legs
    for (const leg of legs) {
      if (leg.espnEventId && !eventIds.includes(leg.espnEventId)) {
        eventIds.push(leg.espnEventId);
      }
    }

    if (eventIds.length > 0) {
      await fetchPlayerStats(eventIds);
    }
  }, [fetchPlayerStats, legs, isToday, parlayCreatedAt]);

  // Build player lookup and update legs
  useEffect(() => {
    // Fully finalized with rich DB data — restore from DB
    if (fullyFinalized) {
      const restored = legs.map((leg) => {
        const hasGameData = leg.gameHomeTeam && leg.gameAwayTeam;
        const restoredScore: GameScore | undefined = hasGameData
          ? {
              homeTeam: leg.gameHomeTeam!,
              awayTeam: leg.gameAwayTeam!,
              homeScore: leg.gameHomeScore ?? 0,
              awayScore: leg.gameAwayScore ?? 0,
              period: leg.gamePeriod ?? "Final",
              clock: "0:00",
              isLive: false,
              isComplete: true,
              espnEventId: leg.espnEventId || "",
            }
          : undefined;
        return {
          ...leg,
          score: restoredScore,
          currentStatValue: leg.finalStatValue ?? undefined,
          targetStatValue: leg.targetStatValue ?? undefined,
          statLabel: leg.statLabel ?? undefined,
        };
      });
      setUpdatedLegs(restored);
      return;
    }

    if (scores.length === 0) {
      setUpdatedLegs(legs);
      return;
    }

    // Build player lookup: playerName → { teamAbbr, eventId, game, stat }
    const playerLookup = new Map<string, PlayerLookup>();
    for (const [eventId, players] of Object.entries(playerStats)) {
      const game = scores.find((s) => s.espnEventId === eventId);
      if (!game) continue;
      for (const p of players) {
        playerLookup.set(p.playerName.toLowerCase(), {
          teamAbbr: p.teamAbbr,
          eventId,
          game,
          stat: p,
        });
      }
    }

    const updated = legs.map((leg) => {
      const playerName = extractPlayerName(leg.team);
      const teamAbbr = resolveTeamAbbr(leg.team);

      if (leg.betType === "prop" && playerName) {
        // Props: look up player directly in box scores
        const lookup = playerLookup.get(playerName.toLowerCase());
        if (!lookup) return leg;

        const displayTeam = `${playerName} (${lookup.teamAbbr})`;

        const { status: propStatus, currentValue, target, statLabel } = evaluateProp(
          leg.line,
          lookup.stat,
          lookup.game.isComplete
        );

        return {
          ...leg,
          team: displayTeam,
          score: lookup.game,
          status: propStatus,
          playerStat: lookup.stat,
          currentStatValue: currentValue,
          targetStatValue: target,
          statLabel,
        };
      }

      // Non-prop: match by team abbr
      if (!teamAbbr) return leg;

      const game = scores.find(
        (s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr
      );
      if (!game) return leg;

      const newStatus = evaluateLeg(
        leg.betType as BetType,
        leg.line,
        teamAbbr,
        game
      );

      return { ...leg, score: game, status: newStatus };
    });

    setUpdatedLegs(updated);
  }, [scores, playerStats, legs, fullyFinalized]);

  // Auto-finalize when all legs resolved
  useEffect(() => {
    if (fullyFinalized || finalizedRef.current || !parlayId) return;

    const allFinal = updatedLegs.every((l) => FINAL_STATUSES.has(l.status));
    const anyResolved = updatedLegs.some((l) => FINAL_STATUSES.has(l.status));
    if (!allFinal || !anyResolved) return;

    finalizedRef.current = true;

    const legUpdates = updatedLegs.map((l) => ({
      id: l.id,
      status: l.status,
      finalStatValue: l.currentStatValue ?? null,
      targetStatValue: l.targetStatValue ?? null,
      statLabel: l.statLabel ?? null,
      gameHomeTeam: l.score?.homeTeam ?? null,
      gameAwayTeam: l.score?.awayTeam ?? null,
      gameHomeScore: l.score?.homeScore ?? null,
      gameAwayScore: l.score?.awayScore ?? null,
      gamePeriod: l.score?.period ?? null,
      gameCompleted: l.score?.isComplete ?? null,
    }));
    fetch(`/api/parlays/${parlayId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs: legUpdates }),
    }).catch(() => {
      finalizedRef.current = false;
    });
  }, [updatedLegs, parlayId, fullyFinalized]);

  // Polling
  useEffect(() => {
    if (!enabled || fullyFinalized) return;

    fetchAll();

    if (!isToday) return;

    const hasLiveGames = scoresRef.current.some((s) => s.isLive);
    const interval = hasLiveGames ? 30000 : 120000;

    const timer = setInterval(fetchAll, interval);
    return () => clearInterval(timer);
  }, [enabled, fetchAll, isToday, fullyFinalized]);

  return { scores, legs: updatedLegs };
}
