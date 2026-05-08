"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManualEntryForm } from "@/components/ManualEntryForm";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { LegConfirmation } from "@/components/LegConfirmation";
import { ParsedLeg } from "@/lib/types";
import { resolveTeamAbbr } from "@/lib/team-matcher";

type Mode = "choose" | "manual" | "screenshot" | "confirm";

export default function NewParlayPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [parsedLegs, setParsedLegs] = useState<ParsedLeg[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [wager, setWager] = useState("");
  const [gameDate, setGameDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const handleParsed = (legs: ParsedLeg[]) => {
    setParsedLegs(legs);
    setMode("confirm");
  };

  const handleConfirm = async (legs: ParsedLeg[]) => {
    setSubmitting(true);

    const payload = {
      wagerAmount: wager ? parseFloat(wager) : undefined,
      gameDate,
      legs: legs.map((l) => ({
        team: l.player
          ? `${l.player} (${resolveTeamAbbr(l.team) || l.team})`
          : l.team,
        opponent: l.opponent,
        betType: l.betType === "player_prop" ? "prop" : l.betType,
        line: l.line,
        odds: l.odds || -110,
      })),
    };

    const res = await fetch("/api/parlays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const parlay = await res.json();
      router.push(`/parlay/${parlay.id}`);
    } else {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">New Parlay</h1>
      </div>

      {mode === "choose" && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("screenshot")}
            className="border rounded-lg p-8 text-center hover:border-primary transition-colors"
          >
            <div className="text-4xl mb-2">📸</div>
            <div className="font-semibold">Upload Screenshot</div>
            <div className="text-sm text-muted-foreground mt-1">
              AI extracts bet details
            </div>
          </button>
          <button
            onClick={() => setMode("manual")}
            className="border rounded-lg p-8 text-center hover:border-primary transition-colors"
          >
            <div className="text-4xl mb-2">✍️</div>
            <div className="font-semibold">Manual Entry</div>
            <div className="text-sm text-muted-foreground mt-1">
              Type in each leg
            </div>
          </button>
        </div>
      )}

      {mode === "screenshot" && (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("choose")}
          >
            &larr; Back to options
          </Button>
          <ScreenshotUploader onParsed={handleParsed} />
          <div className="text-center text-sm text-muted-foreground">
            Not working?{" "}
            <button
              onClick={() => setMode("manual")}
              className="underline"
            >
              Enter manually
            </button>
          </div>
        </div>
      )}

      {mode === "confirm" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <Label htmlFor="game-date">Game Date</Label>
              <Input
                id="game-date"
                type="date"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
              />
            </div>
            <div className="border rounded-lg p-4">
              <Label htmlFor="wager-confirm">Wager Amount ($)</Label>
              <Input
                id="wager-confirm"
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={wager}
                onChange={(e) => setWager(e.target.value)}
              />
            </div>
          </div>

          <LegConfirmation
            legs={parsedLegs}
            onConfirm={handleConfirm}
            onBack={() => setMode("screenshot")}
          />

          {submitting && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              Creating parlay...
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("choose")}
          >
            &larr; Back to options
          </Button>
          <ManualEntryForm />
        </div>
      )}
    </main>
  );
}
