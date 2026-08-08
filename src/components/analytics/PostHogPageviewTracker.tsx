import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import posthog from "@/lib/posthog";

export function PostHogPageviewTracker() {
  const location = useLocation();

  useEffect(() => {
    posthog?.capture("$pageview", {
      $current_url: window.location.href,
      app_route: `${location.pathname}${location.search}${location.hash}`,
    });
  }, [location.hash, location.pathname, location.search]);

  return null;
}
