import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Brief, captureRequestSchema, createBriefRequestSchema, formatBriefPayload } from "@relay/shared";

const app = new Hono();
const briefs = new Map<string, Brief>();

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
  const now = new Date().toISOString();
  const content = capture.rawMessages.map((message) => message.content).join("\n");
  const brief = {
    id: crypto.randomUUID(),
    title: capture.title ?? "Untitled Brief",
    summary: content.slice(0, 240) || "No summary generated yet.",
    userIntent: capture.rawMessages.find((message) => message.role === "user")?.content ?? "Unknown intent",
    constraints: [],
    keyDecisions: [],
    technicalDetails: [],
    sourceTool: capture.sourceTool,
    sourceUrl: capture.sourceUrl,
    rawMessages: capture.rawMessages,
    formattedPayload: "",
    createdAt: now,
    updatedAt: now
  };

  brief.formattedPayload = formatBriefPayload(brief);

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
