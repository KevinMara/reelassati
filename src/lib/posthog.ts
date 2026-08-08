import posthog from "posthog-js";

const projectToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

const posthogClient =
  typeof window !== "undefined" && projectToken && host
    ? posthog.init(projectToken, {
        api_host: host,
        defaults: "2026-05-30",
        capture_pageview: false,
        capture_exceptions: true,
      })
    : undefined;

export default posthogClient;
