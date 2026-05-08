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

  const localDate = isoDate.slice(0, 10).replace(/-/g, "");
  candidates.add(localDate);

  const parts = isoDate.slice(0, 10).split("-").map(Number);
  const localDayBefore = new Date(parts[0], parts[1] - 1, parts[2] - 1);
  candidates.add(toESPNDate(localDayBefore));

  return [...candidates];
}

const FINAL_STATUSES = new Set(["won", "lost", "push"]);

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

  const fetchAll = useCallback(async () => {
    // Collect team abbrs we can resolve
    const neededTeams = new Set<string>();
    let hasUnresolvableLegs = false;
    for (const leg of legs) {
      const abbr = resolveTeamAbbr(leg.team);
      if (abbr) {
        neededTeams.add(abbr);
      } else {
        hasUnresolvableLegs = true;
      }
    }

    let allScores: GameScore[] = [];

    if (isToday) {
      const res = await fetch("/api/scores").catch(() => null);
      if (res?.ok) allScores = await res.json();
    } else if (parlayCreatedAt) {
      const dates = getCandidateDates(parlayCreatedAt);

      if (hasUnresolvableLegs) {
        // Can't filter by team — fetch ALL games for candidate dates
        for (const date of dates) {
          const res = await fetch(`/api/scores?date=${date}`).catch(() => null);
          if (!res?.ok) continue;
          const dayScores: GameScore[] = await res.json();
          for (const game of dayScores) {
            if (!allScores.some((s) => s.espnEventId === game.espnEventId)) {
              allScores.push(game);
            }
          }
        }
      } else {
        const foundTeams = new Set<string>();
        for (const date of dates) {
          const allFound = [...neededTeams].every((t) => foundTeams.has(t));
          if (allFound) break;

          const res = await fetch(`/api/scores?date=${date}`).catch(() => null);
          if (!res?.ok) continue;
          const dayScores: GameScore[] = await res.json();

          for (const game of dayScores) {
            if (neededTeams.has(game.homeTeam) || neededTeams.has(game.awayTeam)) {
              if (!allScores.some((s) => s.espnEventId === game.espnEventId)) {
                allScores.push(game);
                foundTeams.add(game.homeTeam);
                foundTeams.add(game.awayTeam);
              }
            }
          }
        }
      }
    }

    setScores(allScores);

    // Collect event IDs — for unresolvable legs, fetch ALL game box scores
    const eventIds = new Set<string>();
    for (const leg of legs) {
      if (leg.espnEventId) {
        eventIds.add(leg.espnEventId);
      } else {
        const teamAbbr = resolveTeamAbbr(leg.team);
        if (teamAbbr) {
          const game = allScores.find(
            (s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr
          );
          if (game) eventIds.add(game.espnEventId);
        }
      }
    }

    // If we have unresolvable legs, fetch box scores for ALL games
    if (hasUnresolvableLegs) {
      for (const game of allScores) {
        eventIds.add(game.espnEventId);
      }
    }

    if (eventIds.size > 0) {
      await fetchPlayerStats([...eventIds]);
    }
  }, [fetchPlayerStats, legs, isToday, parlayCreatedAt]);

  // Update leg statuses
  useEffect(() => {
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

    // Build a player→{eventId, game} map from all fetched box scores
    const playerGameMap = new Map<string, { eventId: string; game: GameScore }>();
    for (const [eventId, players] of Object.entries(playerStats)) {
      const game = scores.find((s) => s.espnEventId === eventId);
      if (!game) continue;
      for (const p of players) {
        playerGameMap.set(p.playerName.toLowerCase(), { eventId, game });
      }
    }

    const updated = legs.map((leg) => {
      const teamAbbr = resolveTeamAbbr(leg.team);
      const playerName = extractPlayerName(leg.team);

      // Find game: by team abbr, or by player name in box scores
      let game = teamAbbr
        ? scores.find((s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr)
        : undefined;

      let matchedEventId = leg.espnEventId || game?.espnEventId;

      // Fallback: find game by player name in box scores
      if (!game && playerName) {
        const playerMatch = playerGameMap.get(playerName.toLowerCase());
        if (playerMatch) {
          game = playerMatch.game;
          matchedEventId = playerMatch.eventId;
        }
      }

      if (!game) return leg;

      if (leg.betType === "prop") {
        const eventPlayers = playerStats[matchedEventId || ""] || [];
        const stat = playerName
          ? eventPlayers.find(
              (p) => p.playerName.toLowerCase() === playerName.toLowerCase()
            )
          : undefined;

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

      if (!teamAbbr) return leg;

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

  // Auto-finalize
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
