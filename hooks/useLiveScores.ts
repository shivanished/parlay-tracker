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

  // If parlay already finalized in DB, use DB statuses — no fetching needed
  const alreadyFinalized = parlayStatus === "won" || parlayStatus === "lost";

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
    const neededTeams = new Set<string>();
    for (const leg of legs) {
      const abbr = resolveTeamAbbr(leg.team);
      if (abbr) neededTeams.add(abbr);
    }

    let allScores: GameScore[] = [];

    if (isToday) {
      const res = await fetch("/api/scores").catch(() => null);
      if (res?.ok) allScores = await res.json();
    } else if (parlayCreatedAt) {
      const dates = getCandidateDates(parlayCreatedAt);
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

    setScores(allScores);

    const eventIds = new Set<string>();
    for (const leg of legs) {
      if (leg.espnEventId) {
        eventIds.add(leg.espnEventId);
      } else if (leg.betType === "prop") {
        const teamAbbr = resolveTeamAbbr(leg.team);
        if (teamAbbr) {
          const game = allScores.find(
            (s) => s.homeTeam === teamAbbr || s.awayTeam === teamAbbr
          );
          if (game) eventIds.add(game.espnEventId);
        }
      }
    }

    if (eventIds.size > 0) {
      await fetchPlayerStats([...eventIds]);
    }
  }, [fetchPlayerStats, legs, isToday, parlayCreatedAt]);

  // Update leg statuses
  useEffect(() => {
    // Already finalized in DB — just use DB statuses
    if (alreadyFinalized) {
      setUpdatedLegs(legs);
      return;
    }

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

      if (FINAL_STATUSES.has(leg.status)) {
        return { ...leg, score: game };
      }

      if (leg.betType === "prop") {
        const playerName = extractPlayerName(leg.team);
        const eventId = leg.espnEventId || game.espnEventId;
        const eventPlayers = playerStats[eventId] || [];
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

      const newStatus = evaluateLeg(
        leg.betType as BetType,
        leg.line,
        teamAbbr,
        game
      );

      return { ...leg, score: game, status: newStatus };
    });

    setUpdatedLegs(updated);
  }, [scores, playerStats, legs, alreadyFinalized]);

  // Auto-finalize: when all legs have final status, persist to DB
  useEffect(() => {
    if (alreadyFinalized || finalizedRef.current || !parlayId) return;

    const allFinal = updatedLegs.every((l) => FINAL_STATUSES.has(l.status));
    const anyResolved = updatedLegs.some((l) => FINAL_STATUSES.has(l.status));
    if (!allFinal || !anyResolved) return;

    finalizedRef.current = true;

    const legUpdates = updatedLegs.map((l) => ({ id: l.id, status: l.status }));
    fetch(`/api/parlays/${parlayId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs: legUpdates }),
    }).catch(() => {
      finalizedRef.current = false; // retry next cycle
    });
  }, [updatedLegs, parlayId, alreadyFinalized]);

  // Polling — skip entirely if already finalized
  useEffect(() => {
    if (!enabled || alreadyFinalized) return;

    fetchAll();

    if (!isToday) return;

    const hasLiveGames = scoresRef.current.some((s) => s.isLive);
    const interval = hasLiveGames ? 30000 : 120000;

    const timer = setInterval(fetchAll, interval);
    return () => clearInterval(timer);
  }, [enabled, fetchAll, isToday, alreadyFinalized]);

  return { scores, legs: updatedLegs };
}
