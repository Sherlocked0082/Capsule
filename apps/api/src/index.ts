import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Brief, CaptureRequest, captureRequestSchema, createBriefRequestSchema, formatBriefPayload } from "@relay/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function defaultBaseUrlForProvider(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "openai":
    default:
      return "https://api.openai.com/v1";
  }
}

function defaultModelForProvider(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "openrouter/free";
    case "groq":
      return "llama-3.1-8b-instant";
    case "openai":
    default:
      return "gpt-4o-mini";
  }
}

const app = new Hono();
const briefs = new Map<string, Brief>();
const LLM_PROVIDER = process.env.LLM_PROVIDER ?? "openai";
const LLM_API_KEY = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL?.trim() || defaultBaseUrlForProvider(LLM_PROVIDER);
const LLM_MODEL = process.env.LLM_MODEL ?? process.env.OPENAI_BRIEF_MODEL ?? defaultModelForProvider(LLM_PROVIDER);

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
    generationMetadata: {
      mode: "heuristic"
    },
    createdAt: now,
    updatedAt: now
  };

  brief.formattedPayload = formatBriefPayload(brief);
  return brief;
}

type BriefDraft = Pick<
  Brief,
  "title" | "summary" | "userIntent" | "constraints" | "keyDecisions" | "technicalDetails"
>;

function normalizeBriefDraft(parsed: BriefDraft): BriefDraft {
  return {
    title: clampText(normalizeWhitespace(parsed.title), 72),
    summary: clampText(normalizeWhitespace(parsed.summary), 280),
    userIntent: clampText(normalizeWhitespace(parsed.userIntent), 220),
    constraints: unique(parsed.constraints).slice(0, 5),
    keyDecisions: unique(parsed.keyDecisions).slice(0, 5),
    technicalDetails: unique(parsed.technicalDetails).slice(0, 8)
  };
}

function buildOpenAiMessages(capture: CaptureRequest) {
  const transcript = capture.rawMessages
    .map((message, index) => `${index + 1}. [${message.role.toUpperCase()}] ${normalizeWhitespace(message.content)}`)
    .join("\n");

  return [
    {
      role: "system",
      content:
        "You convert AI chat transcripts into compact transfer briefs. Extract only durable working state. Do not copy the whole transcript. Keep arrays concise and high-signal. Exclude exploratory questions unless they became decisions or constraints."
    },
    {
      role: "user",
      content: [
        `Source tool: ${capture.sourceTool}`,
        `Source URL: ${capture.sourceUrl}`,
        `Current title: ${capture.title ?? "Untitled"}`,
        "",
        "Return JSON only using the provided schema.",
        "",
        "Transcript:",
        transcript
      ].join("\n")
    }
  ];
}

function buildJsonOnlyMessages(capture: CaptureRequest) {
  const transcript = capture.rawMessages
    .map((message, index) => `${index + 1}. [${message.role.toUpperCase()}] ${normalizeWhitespace(message.content)}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "You convert AI chat transcripts into compact transfer briefs.",
        "Return valid JSON only.",
        "Do not use markdown fences.",
        "Use this exact object shape:",
        '{',
        '  "title": string,',
        '  "summary": string,',
        '  "userIntent": string,',
        '  "constraints": string[],',
        '  "keyDecisions": string[],',
        '  "technicalDetails": string[]',
        '}',
        "Extract only durable working state. Exclude exploratory questions unless they became decisions or constraints."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Source tool: ${capture.sourceTool}`,
        `Source URL: ${capture.sourceUrl}`,
        `Current title: ${capture.title ?? "Untitled"}`,
        "",
        "Transcript:",
        transcript
      ].join("\n")
    }
  ];
}

async function generateBriefWithProvider(capture: CaptureRequest): Promise<BriefDraft | null> {
  if (!LLM_API_KEY) {
    return null;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${LLM_API_KEY}`
  };

  if (LLM_PROVIDER === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/Sherlocked0082/Capsule";
    headers["X-Title"] = "Relay";
  }

  const requestBody = {
    model: LLM_MODEL,
    messages: buildOpenAiMessages(capture),
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "relay_brief",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            userIntent: { type: "string" },
            constraints: {
              type: "array",
              items: { type: "string" }
            },
            keyDecisions: {
              type: "array",
              items: { type: "string" }
            },
            technicalDetails: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["title", "summary", "userIntent", "constraints", "keyDecisions", "technicalDetails"]
        }
      }
    }
  };

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const unsupportedStructuredOutput =
      response.status === 400 && /response format|json_schema|structured outputs/i.test(errorText);

    if (!unsupportedStructuredOutput) {
      throw new Error(`${LLM_PROVIDER} brief generation failed with status ${response.status}: ${errorText}`);
    }

    console.log(`[relay] provider=${LLM_PROVIDER} model=${LLM_MODEL} does not support json_schema, retrying with plain JSON`);

    const fallbackResponse = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: buildJsonOnlyMessages(capture)
      })
    });

    if (!fallbackResponse.ok) {
      const fallbackErrorText = await fallbackResponse.text();
      throw new Error(
        `${LLM_PROVIDER} plain-json brief generation failed with status ${fallbackResponse.status}: ${fallbackErrorText}`
      );
    }

    const fallbackJson = (await fallbackResponse.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const fallbackContent = fallbackJson.choices?.[0]?.message?.content;
    if (!fallbackContent) {
      throw new Error(`${LLM_PROVIDER} plain-json brief generation returned no content.`);
    }

    const parsedFallback = JSON.parse(fallbackContent) as BriefDraft;
    return normalizeBriefDraft(parsedFallback);
  }

  const json = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI brief generation returned no content.");
  }

  const parsed = JSON.parse(content) as BriefDraft;
  return normalizeBriefDraft(parsed);
}

async function generateBrief(capture: CaptureRequest): Promise<Brief> {
  const heuristicBrief = buildBriefFromCapture(capture);

  try {
    const llmDraft = await generateBriefWithProvider(capture);
    if (!llmDraft) {
      console.log(`[relay] brief generation mode=heuristic reason=no_llm_key provider=${LLM_PROVIDER}`);
      return heuristicBrief;
    }

    const brief: Brief = {
      ...heuristicBrief,
      ...llmDraft,
      generationMetadata: {
        mode: "openai",
        model: `${LLM_PROVIDER}:${LLM_MODEL}`
      }
    };
    brief.formattedPayload = formatBriefPayload(brief);
    console.log(`[relay] brief generation mode=openai provider=${LLM_PROVIDER} model=${LLM_MODEL}`);
    return brief;
  } catch (error) {
    console.warn("Falling back to heuristic brief generation:", error);
    heuristicBrief.generationMetadata = {
      mode: "heuristic",
      fallbackReason: error instanceof Error ? error.message : "unknown_generation_error"
    };
    console.log(`[relay] brief generation mode=heuristic reason=fallback provider=${LLM_PROVIDER}`);
    return heuristicBrief;
  }
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
  const brief = await generateBrief(capture);

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
