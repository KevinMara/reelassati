import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import { initializeI18n } from "@/lib/i18n";
import "@/lib/posthog";
import { PostHogPageviewTracker } from "@/components/analytics/PostHogPageviewTracker";
import App from "./App";
import { usePrivacyPreferences } from "@/components/compliance/PrivacyChoices";
import { hashRouteForDeepLink } from "@/lib/deep-link";

const deepLink = hashRouteForDeepLink(
  location.pathname,
  location.search,
  location.hash
);
if (deepLink) history.replaceState(null, "", deepLink);

function OptionalAnalytics() {
  const preferences = usePrivacyPreferences();
  if (!preferences?.analytics) return null;
  return (
    <>
      <PostHogPageviewTracker />
      {(["reelassati.app", "www.reelassati.app"].includes(
        window.location.hostname
      ) ||
        window.location.hostname.endsWith(".vercel.app")) && <Analytics />}
    </>
  );
}

void initializeI18n().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HashRouter>
        <OptionalAnalytics />
        <App />
      </HashRouter>
    </StrictMode>
  );
});
