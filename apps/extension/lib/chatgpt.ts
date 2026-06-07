import type { CaptureRequest, RawMessage } from "@relay/shared";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

function dedupeMessages(messages: RawMessage[]): RawMessage[] {
  const seen = new Set<string>();
  const deduped: RawMessage[] = [];

  for (const message of messages) {
    const key = `${message.role}:${message.content}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(message);
  }

  return deduped;
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return /(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight + 40;
}

function findConversationScrollContainer(): HTMLElement | null {
  const messageElements = Array.from(document.querySelectorAll("[data-message-author-role]"));

  for (const messageElement of messageElements) {
    let current = messageElement.parentElement;
    while (current) {
      if (isScrollableElement(current)) {
        return current;
      }
      current = current.parentElement;
    }
  }

  const fallback = document.scrollingElement;
  return fallback instanceof HTMLElement ? fallback : null;
}

function buildCapture(rawMessages: RawMessage[]): CaptureRequest {
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

export function extractChatGptCapture(): CaptureRequest {
  return buildCapture(extractMessages());
}

export async function extractChatGptCaptureFull(): Promise<CaptureRequest> {
  const scrollContainer = findConversationScrollContainer();
  if (!scrollContainer) {
    return extractChatGptCapture();
  }

  const initialScrollTop = scrollContainer.scrollTop;
  let combinedMessages = dedupeMessages(extractMessages());
  let stagnantPasses = 0;
  const maxIterations = 14;
  const maxStagnantPasses = 2;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const previousCount = combinedMessages.length;
    const previousScrollTop = scrollContainer.scrollTop;
    const scrollStep = Math.max(scrollContainer.clientHeight * 0.85, 480);
    scrollContainer.scrollTop = Math.max(0, previousScrollTop - scrollStep);

    await wait(650);

    combinedMessages = dedupeMessages([...extractMessages(), ...combinedMessages]);
    const isAtTop = scrollContainer.scrollTop <= 0;
    const didGrow = combinedMessages.length > previousCount;
    const didMove = scrollContainer.scrollTop < previousScrollTop;

    if (!didGrow && (!didMove || isAtTop)) {
      stagnantPasses += 1;
    } else {
      stagnantPasses = 0;
    }

    if ((isAtTop && !didGrow) || stagnantPasses >= maxStagnantPasses) {
      break;
    }
  }

  scrollContainer.scrollTop = initialScrollTop;
  return buildCapture(combinedMessages);
}
