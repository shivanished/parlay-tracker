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

// Get candidate dates to search: creation date in local time, and day before
function getCandidateDates(isoDate: string): string[] {
  const d = new Date(isoDate);
  const dayBefore = new Date(d);
  dayBefore.setDate(dayBefore.getDate() - 1);

  // Local date and UTC date may differ — try both
  const candidates = new Set<string>();
  candidates.add(toESPNDate(d));
  candidates.add(toESPNDate(dayBefore));

  // Also add based on local interpretation
  const localDate = isoDate.slice(0, 10).replace(/-/g, "");
  candidates.add(localDate);

  const parts = isoDate.slice(0, 10).split("-").map(Number);
  const localDayBefore = new Date(parts[0], parts[1] - 1, parts[2] - 1);
  candidates.add(toESPNDate(localDayBefore));

  return [...candidates];
}

export function useLiveScores(
  legs: LegWithScore[],
  enabled: boolean = true,
  parlayCreatedAt?: string
) {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStat[]>>({});
  const [updatedLegs, setUpdatedLegs] = useState<LegWithScore[]>(legs);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

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
    // Collect all team abbrs we need to find games for
    const neededTeams = new Set<string>();
    for (const leg of legs) {
      const abbr = resolveTeamAbbr(leg.team);
      if (abbr) neededTeams.add(abbr);
    }

    let allScores: GameScore[] = [];

    if (isToday) {
      // Today: just fetch current scoreboard
      const res = await fetch("/api/scores").catch(() => null);
      if (res?.ok) allScores = await res.json();
    } else if (parlayCreatedAt) {
      // Historical: try candidate dates until we find the matching games
      const dates = getCandidateDates(parlayCreatedAt);
      const foundTeams = new Set<string>();

      for (const date of dates) {
        // Skip if we already found all needed teams
        const allFound = [...neededTeams].every((t) => foundTeams.has(t));
        if (allFound) break;

        const res = await fetch(`/api/scores?date=${date}`).catch(() => null);
        if (!res?.ok) continue;
        const dayScores: GameScore[] = await res.json();

        for (const game of dayScores) {
          // Only add games that have teams we need
          if (neededTeams.has(game.homeTeam) || neededTeams.has(game.awayTeam)) {
            // Avoid duplicates
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

    // Collect event IDs for prop legs
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

      if (leg.status === "won" || leg.status === "lost" || leg.status === "push") {
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
  }, [scores, playerStats, legs]);

  // Polling — historical parlays fetch once
  useEffect(() => {
    if (!enabled) return;

    fetchAll();

    if (!isToday) return;

    const hasLiveGames = scoresRef.current.some((s) => s.isLive);
    const interval = hasLiveGames ? 30000 : 120000;

    const timer = setInterval(fetchAll, interval);
    return () => clearInterval(timer);
  }, [enabled, fetchAll, isToday]);

  return { scores, legs: updatedLegs };
}
