import { z } from "zod";

export const sourceToolSchema = z.enum(["chatgpt", "claude", "gemini"]);

export const rawMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
  timestamp: z.string().datetime().optional()
});

export const briefSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  userIntent: z.string().min(1),
  constraints: z.array(z.string()),
  keyDecisions: z.array(z.string()),
  technicalDetails: z.array(z.string()),
  sourceTool: sourceToolSchema,
  sourceUrl: z.string().url(),
  rawMessages: z.array(rawMessageSchema),
  formattedPayload: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const captureRequestSchema = z.object({
  sourceTool: sourceToolSchema,
  sourceUrl: z.string().url(),
  title: z.string().optional(),
  rawMessages: z.array(rawMessageSchema).min(1)
});

export const generateBriefRequestSchema = z.object({
  capture: captureRequestSchema
});

export const createBriefRequestSchema = z.object({
  brief: briefSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
  })
});

export type SourceTool = z.infer<typeof sourceToolSchema>;
export type RawMessage = z.infer<typeof rawMessageSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type CaptureRequest = z.infer<typeof captureRequestSchema>;
export type GenerateBriefRequest = z.infer<typeof generateBriefRequestSchema>;
export type CreateBriefRequest = z.infer<typeof createBriefRequestSchema>;

export function formatBriefPayload(brief: Omit<Brief, "id" | "createdAt" | "updatedAt">): string {
  const sections = [
    "**ACTIVE BRIEF CONTEXT**",
    "",
    `- **User Intent**: ${brief.userIntent}`,
    "",
    `- **Key decisions made**: ${brief.keyDecisions.join("; ") || "None recorded."}`,
    "",
    `- **Constraints or requirements identified**: ${brief.constraints.join("; ") || "None recorded."}`,
    "",
    `- **Technicalities/Details**: ${brief.technicalDetails.join("; ") || "None recorded."}`
  ];

  return sections.join("\n");
}
