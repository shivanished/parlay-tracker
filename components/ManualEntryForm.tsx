"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LegInput {
  team: string;
  opponent: string;
  betType: string;
  line: string;
  odds: string;
}

const emptyLeg = (): LegInput => ({
  team: "",
  opponent: "",
  betType: "spread",
  line: "",
  odds: "",
});

export function ManualEntryForm() {
  const router = useRouter();
  const [legs, setLegs] = useState<LegInput[]>([emptyLeg()]);
  const [wager, setWager] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateLeg = (index: number, field: keyof LegInput, value: string) => {
    setLegs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addLeg = () => setLegs((prev) => [...prev, emptyLeg()]);

  const removeLeg = (index: number) => {
    if (legs.length <= 1) return;
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      wagerAmount: wager ? parseFloat(wager) : undefined,
      legs: legs.map((l) => ({
        team: l.team.trim(),
        opponent: l.opponent.trim(),
        betType: l.betType,
        line: l.line.trim(),
        odds: parseInt(l.odds),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {legs.map((leg, i) => (
        <div
          key={i}
          className="border rounded-lg p-4 space-y-3 relative"
        >
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Leg {i + 1}</h3>
            {legs.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeLeg(i)}
                className="text-red-500 h-6 px-2"
              >
                Remove
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`team-${i}`}>Team</Label>
              <Input
                id={`team-${i}`}
                placeholder="e.g. Lakers"
                value={leg.team}
                onChange={(e) => updateLeg(i, "team", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor={`opp-${i}`}>Opponent</Label>
              <Input
                id={`opp-${i}`}
                placeholder="e.g. Celtics"
                value={leg.opponent}
                onChange={(e) => updateLeg(i, "opponent", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Bet Type</Label>
              <Select
                value={leg.betType}
                onValueChange={(v) => { if (v) updateLeg(i, "betType", v); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spread">Spread</SelectItem>
                  <SelectItem value="moneyline">Moneyline</SelectItem>
                  <SelectItem value="over_under">Over/Under</SelectItem>
                  <SelectItem value="prop">Prop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`line-${i}`}>Line</Label>
              <Input
                id={`line-${i}`}
                placeholder={
                  leg.betType === "moneyline"
                    ? "N/A"
                    : leg.betType === "over_under"
                      ? "O 220.5"
                      : "-3.5"
                }
                value={leg.line}
                onChange={(e) => updateLeg(i, "line", e.target.value)}
                required={leg.betType !== "moneyline"}
              />
            </div>
            <div>
              <Label htmlFor={`odds-${i}`}>Odds</Label>
              <Input
                id={`odds-${i}`}
                placeholder="-110"
                value={leg.odds}
                onChange={(e) => updateLeg(i, "odds", e.target.value)}
                required
              />
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addLeg}
        className="w-full"
      >
        + Add Leg
      </Button>

      <div className="border rounded-lg p-4">
        <Label htmlFor="wager">Wager Amount ($)</Label>
        <Input
          id="wager"
          type="number"
          step="0.01"
          min="0"
          placeholder="Optional"
          value={wager}
          onChange={(e) => setWager(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating..." : "Create Parlay"}
      </Button>
    </form>
  );
}
