import { useEffect, useState } from "react";
import { detectSupportedTool, type SupportedTool } from "../../lib/site";

type TabState = {
  url: string | null;
  tool: SupportedTool | null;
};

const initialTabState: TabState = {
  url: null,
  tool: null
};

export function App() {
  const [tabState, setTabState] = useState<TabState>(initialTabState);
  const [isLoading, setIsLoading] = useState(true);

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
        {isSupported ? `Capture from ${tabState.tool}` : "Capture unavailable on this site"}
      </button>
    </main>
  );
}
