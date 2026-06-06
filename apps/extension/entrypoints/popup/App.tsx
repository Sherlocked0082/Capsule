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
        width: 312,
        minHeight: 388,
        padding: 10,
        background:
          "radial-gradient(circle at top, rgba(86, 111, 138, 0.16), transparent 28%), #0b0d12",
        color: "#f3f4f6",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <section
        style={{
          borderRadius: 22,
          border: "1px solid rgba(33, 40, 53, 0.9)",
          background: "rgba(14, 17, 23, 0.94)",
          boxShadow: "0 18px 42px rgba(0,0,0,0.34)",
          overflow: "hidden"
        }}
      >
        <div
        style={{
            padding: 12,
            borderBottom: "1px solid rgba(255,255,255,0.06)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "#8ea4bd",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  marginBottom: 4
                }}
              >
                Relay
              </div>
              <h1 style={{ fontSize: 18, margin: 0, lineHeight: 1.1 }}>Capture Context</h1>
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: "rgba(96, 120, 146, 0.16)",
                border: "1px solid rgba(96, 120, 146, 0.24)",
                color: "#b8c7d8",
                fontWeight: 700
              }}
            >
              R
            </div>
          </div>
          <p style={{ color: "#97a0b2", lineHeight: 1.45, margin: 0, fontSize: 11 }}>
            Turn the current AI thread into a structured brief you can reuse in another tool.
          </p>
        </div>

        <div style={{ padding: 12 }}>
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(19, 23, 32, 0.92)",
              padding: 10,
              marginBottom: 10
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8
              }}
            >
              <div style={{ fontSize: 12, color: "#97a0b2" }}>Current page</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isSupported ? "#b6f7c2" : "#f0b5b5",
                  background: isSupported ? "rgba(47, 128, 78, 0.18)" : "rgba(128, 47, 47, 0.18)",
                  border: `1px solid ${isSupported ? "rgba(47, 128, 78, 0.35)" : "rgba(128, 47, 47, 0.35)"}`,
                  padding: "3px 7px",
                  borderRadius: 999
                }}
              >
                {isLoading ? "Detecting" : isSupported ? "Supported" : "Unsupported"}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize", marginBottom: 6 }}>
              {isLoading ? "Detecting..." : tabState.tool ?? "Unsupported site"}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "#7e8798",
                wordBreak: "break-all",
                lineHeight: 1.35
              }}
            >
              {tabState.url ?? "No active tab URL available"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(19, 23, 32, 0.72)",
              padding: 10,
              marginBottom: 10
            }}
          >
            <div style={{ fontSize: 11.5, color: "#97a0b2", marginBottom: 6 }}>Capture mode</div>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              <strong style={{ color: "#f3f4f6" }}>Quick Capture</strong>
              <span style={{ color: "#97a0b2" }}>
                {" "}
                reads the messages currently loaded in the page and sends them to the Relay API.
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={!isSupported || isLoading || captureState.status === "capturing"}
            onClick={handleCapture}
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid rgba(96, 120, 146, 0.26)",
              background: isSupported
                ? "linear-gradient(180deg, rgba(79, 96, 117, 0.35), rgba(49, 62, 80, 0.45))"
                : "#0f1218",
              color: isSupported ? "#e4edf7" : "#697386",
              padding: "11px 12px",
              cursor: isSupported ? "pointer" : "not-allowed",
              fontSize: 12.5,
              fontWeight: 700,
              boxShadow: isSupported ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none"
            }}
          >
            {captureState.status === "capturing"
              ? "Capturing conversation..."
              : isSupported
                ? `Capture from ${tabState.tool}`
                : "Capture unavailable on this site"}
          </button>

          {captureState.status === "error" ? (
            <div
              style={{
                marginTop: 12,
                borderRadius: 12,
                border: "1px solid rgba(128, 47, 47, 0.35)",
                background: "rgba(37, 19, 21, 0.95)",
                color: "#ffb4b4",
                padding: 10,
                fontSize: 11.5,
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Capture failed</div>
              {captureState.message}
            </div>
          ) : null}

          {captureState.status === "success" ? (
            <div
              style={{
                marginTop: 12,
                borderRadius: 12,
                border: "1px solid rgba(47, 128, 78, 0.35)",
                background: "rgba(16, 27, 19, 0.95)",
                color: "#c6f6cf",
                padding: 10,
                fontSize: 11.5,
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Brief saved</div>
              <div style={{ marginBottom: 6, color: "#f3f4f6" }}>{captureState.brief.title}</div>
              <div style={{ color: "#97a0b2" }}>{captureState.brief.summary}</div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              color: "#7e8798",
              fontSize: 10.5,
              lineHeight: 1.45
            }}
          >
            Next: recent briefs, full capture, and injection into supported tools.
          </div>
        </div>
      </section>
    </main>
  );
}
