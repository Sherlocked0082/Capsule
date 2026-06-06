import type { CaptureRequest, RawMessage } from "@relay/shared";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractMessageText(element: Element): string {
  const prose = element.querySelector("[class*='prose']");
  const source = prose ?? element;
  return normalizeWhitespace(source.textContent ?? "");
}

function extractMessages(): RawMessage[] {
  const candidates = Array.from(document.querySelectorAll("[data-message-author-role]"));
  const messages: RawMessage[] = [];

  for (const element of candidates) {
    const role = element.getAttribute("data-message-author-role");
    if (role !== "user" && role !== "assistant") {
      continue;
    }

    const content = extractMessageText(element);
    if (!content) {
      continue;
    }

    messages.push({
      role,
      content
    });
  }

  return messages;
}

export function extractChatGptCapture(): CaptureRequest {
  const rawMessages = extractMessages();

  if (rawMessages.length === 0) {
    throw new Error("No ChatGPT messages found on this page.");
  }

  return {
    sourceTool: "chatgpt",
    sourceUrl: window.location.href,
    title: document.title.replace(/\s*-\s*ChatGPT\s*$/i, "").trim() || "Untitled ChatGPT conversation",
    rawMessages
  };
}
