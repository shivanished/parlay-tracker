import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logger } from "@/lib/logger";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are parsing OCR text extracted from a sportsbook parlay screenshot. Extract every bet leg you can find.

For each leg, return:
- player: player name if it's a player prop, empty string for team bets
- team: team name (infer from player or context if possible)
- opponent: opposing team if visible, empty string otherwise
- betType: one of "spread", "moneyline", "over_under", "player_prop"
- line: the bet line exactly as shown (e.g. "1+ threes", "-3.5", "O 220.5", "15+ points")
- stat: for player props, the stat category (e.g. "threes", "points", "rebounds", "assists", "steals", "blocks"). null for non-prop bets
- odds: American odds as integer (e.g. -110, +150). Use 0 if not visible in the text
- confidence: 0.0 to 1.0 — how confident you are this leg was correctly parsed. 1.0 = clearly visible and unambiguous. 0.7 = partially visible or inferred. 0.3 = guessing
- gameDate: ISO date string (YYYY-MM-DD) if a date is visible in the text, null otherwise

Common OCR patterns:
- "Cade Cunningham: 1+ threes" → player_prop, player="Cade Cunningham", line="1+ threes", stat="threes"
- "Lakers -3.5 (-110)" → spread, team="Lakers", line="-3.5", odds=-110
- "Over 220.5 (-110)" → over_under, line="O 220.5"
- Lines showing current stats like "5 points" below a leg are live updates, NOT bet legs — skip them
- Lines like "@ Los Angeles L at Oklahoma City" are game matchup headers, NOT legs — use them to infer team/opponent for surrounding legs`;

const responseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "parsed_legs",
    strict: true,
    schema: {
      type: "object",
      properties: {
        legs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              player: { type: "string" },
              team: { type: "string" },
              opponent: { type: "string" },
              betType: { type: "string", enum: ["spread", "moneyline", "over_under", "player_prop"] },
              line: { type: "string" },
              stat: { type: ["string", "null"] },
              odds: { type: "number" },
              confidence: { type: "number" },
              gameDate: { type: ["string", "null"] },
            },
            required: ["player", "team", "opponent", "betType", "line", "stat", "odds", "confidence", "gameDate"],
            additionalProperties: false,
          },
        },
      },
      required: ["legs"],
      additionalProperties: false,
    },
  },
};

export async function POST(req: NextRequest) {
  logger.request("POST", "/api/parse-ocr");

  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY not set");
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  try {
    const { ocrText } = await req.json();

    if (!ocrText || typeof ocrText !== "string") {
      return NextResponse.json({ error: "ocrText required" }, { status: 400 });
    }

    logger.info("Parsing OCR text", { length: ocrText.length, lines: ocrText.split("\n").filter(Boolean).length });

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: responseSchema,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse these bet legs from OCR text:\n\n${ocrText}` },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.error("Empty response from OpenAI");
      return NextResponse.json({ error: "AI returned empty response" }, { status: 502 });
    }

    const parsed = JSON.parse(content);
    logger.info("OCR parsed by AI", {
      legs: parsed.legs.length,
      avgConfidence: parsed.legs.length > 0
        ? Math.round(parsed.legs.reduce((s: number, l: { confidence: number }) => s + l.confidence, 0) / parsed.legs.length * 100)
        : 0,
      model: completion.model,
      tokens: completion.usage?.total_tokens,
    });

    return NextResponse.json({ legs: parsed.legs, rawText: ocrText });
  } catch (err) {
    logger.error("OCR parse failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to parse OCR text", detail: String(err) },
      { status: 500 }
    );
  }
}
