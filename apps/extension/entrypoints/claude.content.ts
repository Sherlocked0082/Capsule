import { defineContentScript } from "wxt/utils/define-content-script";
import { injectIntoClaudePrompt } from "../lib/targets/claude";

type InjectMessage = {
  type: "relay:inject-claude";
  payload: string;
};

type InjectResponse =
  | { ok: true }
  | { ok: false; error: string };

export default defineContentScript({
  matches: ["https://claude.ai/*"],
  main() {
    chrome.runtime.onMessage.addListener((message: InjectMessage, _sender, sendResponse) => {
      if (message?.type !== "relay:inject-claude") {
        return undefined;
      }

      let response: InjectResponse;

      try {
        injectIntoClaudePrompt(message.payload);
        response = { ok: true };
      } catch (error) {
        response = {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown Claude injection error"
        };
      }

      sendResponse(response);
      return false;
    });
  }
});
