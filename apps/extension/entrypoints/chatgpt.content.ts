import { captureRequestSchema } from "@relay/shared";
import { defineContentScript } from "wxt/utils/define-content-script";
import { extractChatGptCapture, extractChatGptCaptureFull } from "../lib/chatgpt";

type CaptureResponse =
  | { ok: true; capture: ReturnType<typeof extractChatGptCapture> }
  | { ok: false; error: string };

export default defineContentScript({
  matches: ["https://chatgpt.com/*"],
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "relay:capture-chatgpt" && message?.type !== "relay:capture-chatgpt-full") {
        return undefined;
      }

      void (async () => {
        let response: CaptureResponse;

        try {
          const capture =
            message?.type === "relay:capture-chatgpt-full"
              ? await extractChatGptCaptureFull()
              : extractChatGptCapture();
          const parsed = captureRequestSchema.safeParse(capture);

          if (!parsed.success) {
            response = {
              ok: false,
              error: "Extracted ChatGPT messages did not match the expected capture format."
            };
          } else {
            response = {
              ok: true,
              capture: parsed.data
            };
          }
        } catch (error) {
          response = {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown ChatGPT capture error"
          };
        }

        sendResponse(response);
      })();

      return true;
    });
  }
});
