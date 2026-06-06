import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Relay",
    description: "Capture AI context and reuse it across tools.",
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*"
    ]
  }
});
