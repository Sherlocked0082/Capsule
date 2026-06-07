import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Brief, CaptureRequest, captureRequestSchema, createBriefRequestSchema, formatBriefPayload } from "@relay/shared";

const app = new Hono();
const briefs = new Map<string, Brief>();

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map(normalizeWhitespace).filter(Boolean)));
}

function clampText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function deriveTitle(capture: CaptureRequest): string {
  const existingTitle = normalizeWhitespace(capture.title ?? "");
  if (existingTitle && !/^chatgpt$/i.test(existingTitle)) {
    return existingTitle;
  }

  const firstUserMessage = capture.rawMessages.find((message) => message.role === "user")?.content ?? "Untitled Brief";
  return clampText(normalizeWhitespace(firstUserMessage), 72);
}

function deriveUserIntent(capture: CaptureRequest): string {
  const userMessages = capture.rawMessages.filter((message) => message.role === "user");
  const firstUser = userMessages[0]?.content;
  const firstSentence = firstUser ? splitIntoSentences(firstUser)[0] : "";

  if (firstSentence) {
    return clampText(firstSentence, 220);
  }

  return "Unknown intent";
}

function deriveConstraints(capture: CaptureRequest): string[] {
  const userText = capture.rawMessages
    .filter((message) => message.role === "user")
    .flatMap((message) => splitIntoSentences(message.content));

  const constraints = userText.filter((sentence) =>
    /\b(should|must|need|needs|want|wants|avoid|keep|only|without|cannot|can't|do not|don't)\b/i.test(sentence)
  );

  return unique(constraints).slice(0, 5);
}

function deriveKeyDecisions(capture: CaptureRequest): string[] {
  const allText = capture.rawMessages.flatMap((message) => splitIntoSentences(message.content));
  const decisions = allText.filter((sentence) =>
    /\b(use|using|decide|decided|chosen|choose|recommend|recommended|instructed|suggest|suggested|approach)\b/i.test(
      sentence
    )
  );

  return unique(decisions).slice(0, 5);
}

function deriveTechnicalDetails(capture: CaptureRequest): string[] {
  const allText = capture.rawMessages.flatMap((message) => splitIntoSentences(message.content));
  const technical = allText.filter((sentence) =>
    /(`[^`]+`)|(\b[a-z0-9_-]+\.[a-z0-9_-]+\b)|(\b(mvn|npm|bun|git|curl|docker|terraform|kubectl|jar|unzip)\b)|([/][\w./-]+)|(<[^>]+>)/i.test(
      sentence
    )
  );

  return unique(technical).slice(0, 8);
}

function deriveSummary(capture: CaptureRequest, userIntent: string, keyDecisions: string[], technicalDetails: string[]): string {
  const assistantMessages = capture.rawMessages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => splitIntoSentences(message.content));

  const parts = [
    userIntent,
    keyDecisions[0],
    technicalDetails[0],
    assistantMessages[0]
  ].filter(Boolean);

  return clampText(unique(parts).join(" "), 280) || "No summary generated yet.";
}

function buildBriefFromCapture(capture: CaptureRequest): Brief {
  const now = new Date().toISOString();
  const title = deriveTitle(capture);
  const userIntent = deriveUserIntent(capture);
  const constraints = deriveConstraints(capture);
  const keyDecisions = deriveKeyDecisions(capture);
  const technicalDetails = deriveTechnicalDetails(capture);
  const summary = deriveSummary(capture, userIntent, keyDecisions, technicalDetails);

  const brief: Brief = {
    id: crypto.randomUUID(),
    title,
    summary,
    userIntent,
    constraints,
    keyDecisions,
    technicalDetails,
    sourceTool: capture.sourceTool,
    sourceUrl: capture.sourceUrl,
    rawMessages: capture.rawMessages,
    formattedPayload: "",
    createdAt: now,
    updatedAt: now
  };

  brief.formattedPayload = formatBriefPayload(brief);
  return brief;
}

app.get("/health", (c) => {
  return c.json({ ok: true, service: "relay-api" });
});

app.post("/briefs/generate", async (c) => {
  const body = await c.req.json();
  const parsed = captureRequestSchema.safeParse(body.capture ?? body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const capture = parsed.data;
  const brief = buildBriefFromCapture(capture);

  return c.json({ brief });
});

app.post("/briefs", async (c) => {
  const body = await c.req.json();
  const parsed = createBriefRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const now = new Date().toISOString();
  const brief: Brief = {
    ...parsed.data.brief,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  briefs.set(brief.id, brief);

  return c.json({ brief }, 201);
});

app.get("/briefs", (c) => {
  return c.json({
    briefs: Array.from(briefs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  });
});

app.get("/briefs/:id", (c) => {
  const brief = briefs.get(c.req.param("id"));

  if (!brief) {
    return c.json({ error: "Brief not found" }, 404);
  }

  return c.json({ brief });
});

serve(
  {
    fetch: app.fetch,
    port: 4000
  },
  (info) => {
    console.log(`Relay API running on http://localhost:${info.port}`);
  }
);
