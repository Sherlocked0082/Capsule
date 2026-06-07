function dispatchInputEvents(element: HTMLElement) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  descriptor?.set?.call(textarea, value);
  dispatchInputEvents(textarea);
}

function setContentEditableValue(element: HTMLElement, value: string) {
  element.focus();
  element.textContent = value;
  dispatchInputEvents(element);
}

function findClaudePromptElement(): HTMLElement | HTMLTextAreaElement | null {
  const textarea = document.querySelector("textarea");
  if (textarea instanceof HTMLTextAreaElement) {
    return textarea;
  }

  const contentEditable = document.querySelector("[contenteditable='true']");
  if (contentEditable instanceof HTMLElement) {
    return contentEditable;
  }

  return null;
}

export function injectIntoClaudePrompt(payload: string) {
  const promptElement = findClaudePromptElement();

  if (!promptElement) {
    throw new Error("Claude prompt box was not found on this page.");
  }

  if (promptElement instanceof HTMLTextAreaElement) {
    setTextareaValue(promptElement, payload);
    return;
  }

  setContentEditableValue(promptElement, payload);
}
