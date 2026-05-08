"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ParsedLeg } from "@/lib/types";

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
  const [step, setStep] = useState<"idle" | "ocr" | "ai">("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(
    async (file: File) => {
      setStep("ocr");
      setError(null);
      setStatusText("Reading image...");

      // Validate file type
      if (!ACCEPTED_TYPES.includes(file.type.toLowerCase()) && !isHeic(file)) {
        setError(`Unsupported format: ${file.type || "unknown"}. Use PNG, JPG, WebP, or HEIC.`);
        setStep("idle");
        return;
      }

      // Validate file size
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_SIZE_MB}MB.`);
        setStep("idle");
        return;
      }

      // Convert to canvas PNG
      let imageDataUrl: string;
      try {
        imageDataUrl = await fileToImageDataUrl(file);
        setPreview(imageDataUrl);
      } catch (err) {
        setError(`Image load failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        setStep("idle");
        console.error("[OCR] Image conversion error:", err);
        return;
      }

      // Step 1: Tesseract OCR
      let ocrText: string;
      try {
        setStatusText("Extracting text with OCR...");
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const { data: { text, confidence } } = await worker.recognize(imageDataUrl);
        await worker.terminate();

        console.log("[OCR] Raw text:", text);
        console.log("[OCR] Confidence:", confidence);
        ocrText = text;

        if (!text.trim()) {
          setError("OCR could not extract any text from the image. Try a clearer screenshot.");
          setStep("idle");
          return;
        }

        setStatusText(`OCR done (${Math.round(confidence)}% confidence). Parsing with AI...`);
      } catch (err) {
        setError(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
        setStep("idle");
        console.error("[OCR] Tesseract error:", err);
        return;
      }

      // Step 2: AI parsing
      try {
        setStep("ai");
        const res = await fetch("/api/parse-ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocrText }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `API error ${res.status}`);
        }

        const { legs } = await res.json();
        console.log("[OCR] AI parsed legs:", legs);

        if (!legs || legs.length === 0) {
          setError("AI could not identify any bet legs. Try manual entry.");
          setStep("idle");
          return;
        }

        setStatusText(null);
        onParsed(legs);
      } catch (err) {
        setError(`AI parsing failed: ${err instanceof Error ? err.message : String(err)}`);
        setStep("idle");
        console.error("[OCR] AI parse error:", err);
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

  const processing = step !== "idle";

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => !processing && fileRef.current?.click()}
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
            <p className="font-medium">Drop your parlay screenshot here</p>
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

      {processing && statusText && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          {statusText}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
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
            setStatusText(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        >
          Clear & Try Again
        </Button>
      )}
    </div>
  );
}
