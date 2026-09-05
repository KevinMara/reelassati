import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import { initializeI18n } from "@/lib/i18n";
import "@/lib/posthog";
import { PostHogPageviewTracker } from "@/components/analytics/PostHogPageviewTracker";
import App from "./App";

void initializeI18n().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HashRouter>
        <PostHogPageviewTracker />
        <App />
        {(["reelassati.app", "www.reelassati.app"].includes(
          window.location.hostname
        ) ||
          window.location.hostname.endsWith(".vercel.app")) && <Analytics />}
      </HashRouter>
    </StrictMode>
  );
});
