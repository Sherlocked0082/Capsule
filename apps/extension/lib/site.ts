export type SupportedTool = "chatgpt" | "claude" | "gemini";

const SITE_PATTERNS: Array<{ tool: SupportedTool; pattern: RegExp }> = [
  { tool: "chatgpt", pattern: /^https:\/\/chatgpt\.com\//i },
  { tool: "claude", pattern: /^https:\/\/claude\.ai\//i },
  { tool: "gemini", pattern: /^https:\/\/gemini\.google\.com\//i }
];

export function detectSupportedTool(url?: string | null): SupportedTool | null {
  if (!url) {
    return null;
  }

  const match = SITE_PATTERNS.find(({ pattern }) => pattern.test(url));
  return match?.tool ?? null;
}
