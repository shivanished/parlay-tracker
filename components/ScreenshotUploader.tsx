"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface ParsedLeg {
  team: string;
  opponent: string;
  betType: string;
  line: string;
  odds: string;
}

interface ScreenshotUploaderProps {
  onParsed: (legs: ParsedLeg[]) => void;
}

export function ScreenshotUploader({ onParsed }: ScreenshotUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const {
          data: { text },
        } = await worker.recognize(file);
        await worker.terminate();

        const legs = parseOCRText(text);

        if (legs.length === 0) {
          setError(
            "Could not parse bet details from screenshot. Try manual entry."
          );
        } else {
          onParsed(legs);
        }
      } catch (err) {
        setError(`OCR failed: ${err instanceof Error ? err.message : "Unknown error"}. Try manual entry.`);
      } finally {
        setProcessing(false);
      }
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) processImage(file);
    },
    [processImage]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt="Screenshot preview"
            className="max-h-64 mx-auto rounded"
          />
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📸</div>
            <p className="font-medium">
              Drop your parlay screenshot here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {processing && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Processing screenshot with OCR...
        </div>
      )}

      {error && (
        <div className="text-center text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      {preview && !processing && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setPreview(null);
            setError(null);
          }}
        >
          Clear & Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Parse OCR text to extract bet legs.
 * This uses heuristics for common sportsbook formats.
 */
function parseOCRText(text: string): ParsedLeg[] {
  const legs: ParsedLeg[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Common patterns:
  // "Lakers -3.5 (-110)"
  // "LAL vs BOS Spread -3.5 -110"
  // "Over 220.5 (-110)"

  const spreadRegex =
    /([A-Za-z\s.]+?)\s+([+-]?\d+\.?\d*)\s+\(?\s*([+-]\d+)\s*\)?/;
  const mlRegex =
    /([A-Za-z\s.]+?)\s+(?:ML|Moneyline|Money Line)\s+\(?\s*([+-]\d+)\s*\)?/i;
  const ouRegex =
    /(?:Over|Under|O|U)\s+(\d+\.?\d*)\s+\(?\s*([+-]\d+)\s*\)?/i;

  for (const line of lines) {
    // Try Over/Under
    const ouMatch = line.match(ouRegex);
    if (ouMatch) {
      const isOver = /over|^o\s/i.test(line);
      legs.push({
        team: "Game",
        opponent: "Total",
        betType: "over_under",
        line: `${isOver ? "O" : "U"} ${ouMatch[1]}`,
        odds: ouMatch[2],
      });
      continue;
    }

    // Try Moneyline
    const mlMatch = line.match(mlRegex);
    if (mlMatch) {
      legs.push({
        team: mlMatch[1].trim(),
        opponent: "",
        betType: "moneyline",
        line: "ML",
        odds: mlMatch[2],
      });
      continue;
    }

    // Try Spread
    const spreadMatch = line.match(spreadRegex);
    if (spreadMatch) {
      legs.push({
        team: spreadMatch[1].trim(),
        opponent: "",
        betType: "spread",
        line: spreadMatch[2],
        odds: spreadMatch[3],
      });
      continue;
    }
  }

  return legs;
}
