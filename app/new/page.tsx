"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ManualEntryForm } from "@/components/ManualEntryForm";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";

type Mode = "choose" | "manual" | "screenshot";

export default function NewParlayPage() {
  const [mode, setMode] = useState<Mode>("choose");

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
              OCR extracts bet details
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
          <ScreenshotUploader
            onParsed={(legs) => {
              // For now, log parsed legs — will connect to editor
              console.log("Parsed legs:", legs);
              // Switch to manual mode with pre-filled data
              setMode("manual");
            }}
          />
          <div className="text-center text-sm text-muted-foreground">
            OCR not working well?{" "}
            <button
              onClick={() => setMode("manual")}
              className="underline"
            >
              Enter manually
            </button>
          </div>
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
