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

const ACCEPTED_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp",
  "image/heic", "image/heif",
];
const MAX_SIZE_MB = 10;

function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  return t === "image/heic" || t === "image/heif" || /\.heic$/i.test(file.name);
}

async function convertHeic(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/png", quality: 1 });
  return Array.isArray(result) ? result[0] : result;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read blob"));
    reader.readAsDataURL(blob);
  });
}

async function fileToImageDataUrl(file: File): Promise<string> {
  let blob: Blob = file;

  if (isHeic(file)) {
    console.log("[OCR] Converting HEIC to PNG...");
    blob = await convertHeic(file);
  }

  const dataUrl = await blobToDataUrl(blob);

  // Draw through canvas to normalize to PNG
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Browser could not decode image. Try PNG or JPG."));
    img.src = dataUrl;
  });
}

export function ScreenshotUploader({ onParsed }: ScreenshotUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrDebug, setOcrDebug] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
      setOcrDebug(null);

      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type.toLowerCase()) && !isHeic(file)) {
        setError(
          `Unsupported format: ${file.type || "unknown"}. Use PNG, JPG, WebP, or HEIC.`
        );
        setProcessing(false);
        return;
      }

      // Validate file size
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_SIZE_MB}MB.`);
        setProcessing(false);
        return;
      }

      // Convert to canvas PNG for reliable Tesseract input
      let imageDataUrl: string;
      try {
        imageDataUrl = await fileToImageDataUrl(file);
        setPreview(imageDataUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(`Image load failed: ${msg}`);
        setProcessing(false);
        console.error("[OCR] Image conversion error:", err);
        return;
      }

      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const {
          data: { text, confidence },
        } = await worker.recognize(imageDataUrl);
        await worker.terminate();

        console.log("[OCR] Raw text:", text);
        console.log("[OCR] Confidence:", confidence);
        setOcrDebug(`OCR confidence: ${Math.round(confidence)}% | ${text.split("\n").filter(Boolean).length} lines detected`);

        const legs = parseOCRText(text);

        if (legs.length === 0) {
          setError(
            "Could not parse bet details from screenshot. Try manual entry."
          );
          console.warn("[OCR] No legs parsed from text:", text);
        } else {
          console.log("[OCR] Parsed legs:", legs);
          onParsed(legs);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`OCR failed: ${msg}. Try manual entry.`);
        console.error("[OCR] Tesseract error:", err);
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
      if (file) processImage(file);
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
              PNG, JPG, WebP, or HEIC — max {MAX_SIZE_MB}MB
            </p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {processing && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Processing screenshot with OCR...
        </div>
      )}

      {ocrDebug && !error && (
        <div className="text-center text-xs text-muted-foreground bg-muted p-2 rounded font-mono">
          {ocrDebug}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded space-y-1">
          <p>{error}</p>
          {ocrDebug && (
            <p className="text-xs text-red-400 font-mono">{ocrDebug}</p>
          )}
        </div>
      )}

      {preview && !processing && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setPreview(null);
            setError(null);
            setOcrDebug(null);
            if (fileRef.current) fileRef.current.value = "";
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
 * Uses heuristics for common sportsbook formats.
 */
function parseOCRText(text: string): ParsedLeg[] {
  const legs: ParsedLeg[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const spreadRegex =
    /([A-Za-z\s.]+?)\s+([+-]?\d+\.?\d*)\s+\(?\s*([+-]\d+)\s*\)?/;
  const mlRegex =
    /([A-Za-z\s.]+?)\s+(?:ML|Moneyline|Money Line)\s+\(?\s*([+-]\d+)\s*\)?/i;
  const ouRegex =
    /(?:Over|Under|O|U)\s+(\d+\.?\d*)\s+\(?\s*([+-]\d+)\s*\)?/i;

  for (const line of lines) {
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
