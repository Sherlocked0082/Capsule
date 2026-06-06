import { useEffect, useState } from "react";
import type { Brief, CaptureRequest } from "@relay/shared";
import { detectSupportedTool, type SupportedTool } from "../../lib/site";

type TabState = {
  url: string | null;
  tool: SupportedTool | null;
};

type CaptureState =
  | { status: "idle" }
  | { status: "capturing" }
  | { status: "error"; message: string }
  | { status: "success"; brief: Brief };

const initialTabState: TabState = {
  url: null,
  tool: null
};

export function App() {
  const [tabState, setTabState] = useState<TabState>(initialTabState);
  const [isLoading, setIsLoading] = useState(true);
  const [captureState, setCaptureState] = useState<CaptureState>({ status: "idle" });

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const url = activeTab?.url ?? null;
      setTabState({
        url,
        tool: detectSupportedTool(url)
      });
      setIsLoading(false);
    });
  }, []);

  const isSupported = Boolean(tabState.tool);

  async function generateAndSaveBrief(capture: CaptureRequest): Promise<Brief> {
    const generateResponse = await fetch("http://127.0.0.1:4000/briefs/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ capture })
    });

    if (!generateResponse.ok) {
      throw new Error("Brief generation request failed.");
    }

    const generateJson = (await generateResponse.json()) as { brief?: Brief };
    if (!generateJson.brief) {
      throw new Error("Relay API did not return a generated brief.");
    }

    const saveResponse = await fetch("http://127.0.0.1:4000/briefs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        brief: {
          title: generateJson.brief.title,
          summary: generateJson.brief.summary,
          userIntent: generateJson.brief.userIntent,
          constraints: generateJson.brief.constraints,
          keyDecisions: generateJson.brief.keyDecisions,
          technicalDetails: generateJson.brief.technicalDetails,
          sourceTool: generateJson.brief.sourceTool,
          sourceUrl: generateJson.brief.sourceUrl,
          rawMessages: generateJson.brief.rawMessages,
          formattedPayload: generateJson.brief.formattedPayload
        }
      })
    });

    if (!saveResponse.ok) {
      throw new Error("Saving generated brief failed.");
    }

    const saveJson = (await saveResponse.json()) as { brief?: Brief };
    if (!saveJson.brief) {
      throw new Error("Relay API did not return the saved brief.");
    }

    return saveJson.brief;
  }

  async function handleCapture() {
    if (tabState.tool !== "chatgpt") {
      setCaptureState({
        status: "error",
        message: "Only ChatGPT capture is implemented right now."
      });
      return;
    }

    setCaptureState({ status: "capturing" });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        setCaptureState({
          status: "error",
          message: "No active tab was found."
        });
        return;
      }

      chrome.tabs.sendMessage(
        activeTab.id,
        { type: "relay:capture-chatgpt" },
        async (response?: { ok: boolean; error?: string; capture?: CaptureRequest }) => {
          if (chrome.runtime.lastError) {
            setCaptureState({
              status: "error",
              message: chrome.runtime.lastError.message ?? "Content script communication failed."
            });
            return;
          }

          if (!response?.ok || !response.capture) {
            setCaptureState({
              status: "error",
              message: response?.error ?? "Capture failed."
            });
            return;
          }

          try {
            const brief = await generateAndSaveBrief(response.capture);
            setCaptureState({
              status: "success",
              brief
            });
          } catch (error) {
            setCaptureState({
              status: "error",
              message: error instanceof Error ? error.message : "Unknown brief generation error"
            });
          }
        }
      );
    });
  }

  return (
    <main
      style={{
        width: 360,
        padding: 16,
        background: "#0b0d12",
        color: "#f3f4f6",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <h1 style={{ fontSize: 20, marginTop: 0 }}>Relay</h1>
      <p style={{ color: "#97a0b2", lineHeight: 1.5 }}>
        Capture the current AI conversation, generate a brief, and reuse it in another tool.
      </p>
      <div
        style={{
          borderRadius: 8,
          border: "1px solid #232939",
          background: "#131720",
          padding: 12,
          marginBottom: 12
        }}
      >
        <div style={{ fontSize: 12, color: "#97a0b2", marginBottom: 6 }}>Current page</div>
        <div style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize" }}>
          {isLoading ? "Detecting..." : tabState.tool ?? "Unsupported site"}
        </div>
        <div style={{ fontSize: 12, color: "#97a0b2", marginTop: 6, wordBreak: "break-all" }}>
          {tabState.url ?? "No active tab URL available"}
        </div>
      </div>
      <button
        type="button"
        disabled={!isSupported || isLoading}
        onClick={handleCapture}
        style={{
          width: "100%",
          borderRadius: 8,
          border: "1px solid #232939",
          background: isSupported ? "#131720" : "#0f1218",
          color: isSupported ? "#f3f4f6" : "#697386",
          padding: "12px 14px",
          cursor: isSupported ? "pointer" : "not-allowed"
        }}
      >
        {captureState.status === "capturing"
          ? "Capturing..."
          : isSupported
            ? `Capture from ${tabState.tool}`
            : "Capture unavailable on this site"}
      </button>
      {captureState.status === "error" ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 8,
            border: "1px solid #4b1f1f",
            background: "#251315",
            color: "#ffb4b4",
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          {captureState.message}
        </div>
      ) : null}
      {captureState.status === "success" ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 8,
            border: "1px solid #28442f",
            background: "#101b13",
            color: "#c6f6cf",
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Brief saved</div>
          <div style={{ marginBottom: 6 }}>{captureState.brief.title}</div>
          <div style={{ color: "#97a0b2" }}>{captureState.brief.summary}</div>
        </div>
      ) : null}
    </main>
  );
}
