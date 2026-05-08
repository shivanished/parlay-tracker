"use client";

import { useState } from "react";
import { ParsedLeg } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LegConfirmationProps {
  legs: ParsedLeg[];
  onConfirm: (legs: ParsedLeg[]) => void;
  onBack: () => void;
}

export function LegConfirmation({ legs: initial, onConfirm, onBack }: LegConfirmationProps) {
  const [legs, setLegs] = useState<ParsedLeg[]>(initial);

  const updateLeg = (index: number, field: keyof ParsedLeg, value: string | number | null) => {
    setLegs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeLeg = (index: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const needsReview = (leg: ParsedLeg) => leg.confidence < 0.8;
  const reviewCount = legs.filter(needsReview).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{legs.length} legs detected</h2>
          {reviewCount > 0 && (
            <p className="text-sm text-yellow-600">
              {reviewCount} leg{reviewCount > 1 ? "s" : ""} need review
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          &larr; Back
        </Button>
      </div>

      {legs.map((leg, i) => (
        <div
          key={i}
          className={`border rounded-lg p-4 space-y-3 ${
            needsReview(leg) ? "border-yellow-400 bg-yellow-50/50" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Leg {i + 1}
              </span>
              {needsReview(leg) ? (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">
                  Needs review ({Math.round(leg.confidence * 100)}%)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                  {Math.round(leg.confidence * 100)}% confident
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeLeg(i)}
              className="text-red-500 h-6 px-2"
            >
              Remove
            </Button>
          </div>

          {leg.betType === "player_prop" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Player</Label>
                <Input
                  value={leg.player}
                  onChange={(e) => updateLeg(i, "player", e.target.value)}
                />
              </div>
              <div>
                <Label>Stat</Label>
                <Input
                  value={leg.stat || ""}
                  onChange={(e) => updateLeg(i, "stat", e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Team</Label>
              <Input
                value={leg.team}
                onChange={(e) => updateLeg(i, "team", e.target.value)}
              />
            </div>
            <div>
              <Label>Opponent</Label>
              <Input
                value={leg.opponent}
                onChange={(e) => updateLeg(i, "opponent", e.target.value)}
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
                  <SelectItem value="player_prop">Player Prop</SelectItem>
                  <SelectItem value="spread">Spread</SelectItem>
                  <SelectItem value="moneyline">Moneyline</SelectItem>
                  <SelectItem value="over_under">Over/Under</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Line</Label>
              <Input
                value={leg.line}
                onChange={(e) => updateLeg(i, "line", e.target.value)}
              />
            </div>
            <div>
              <Label>Odds</Label>
              <Input
                type="number"
                value={leg.odds || ""}
                placeholder="e.g. -110"
                onChange={(e) => updateLeg(i, "odds", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {leg.gameDate && (
            <div className="text-xs text-muted-foreground">
              Game: {new Date(leg.gameDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
          )}
        </div>
      ))}

      {legs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          All legs removed. Go back to re-upload or enter manually.
        </div>
      )}

      <Button
        className="w-full"
        disabled={legs.length === 0}
        onClick={() => onConfirm(legs)}
      >
        Confirm {legs.length} Leg{legs.length !== 1 ? "s" : ""} & Create Parlay
      </Button>
    </div>
  );
}
