import type { PostHog } from "posthog-js";
const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
let client: Promise<PostHog | undefined> | undefined;
function getClient() {
  if (!client)
    client = import("posthog-js")
      .then(({ default: sdk }) =>
        sdk.init(token, {
          api_host: host,
          defaults: "2026-05-30",
          capture_pageview: false,
          capture_exceptions: true,
        })
      )
      .catch(() => undefined);
  return client;
}
// Load analytics after the page's first request, not inside the initial UI bundle.
const posthogClient =
  typeof window !== "undefined" && token && host
    ? {
        capture: (...args: Parameters<PostHog["capture"]>) => {
          void getClient().then(sdk => sdk?.capture(...args));
        },
        identify: (...args: Parameters<PostHog["identify"]>) => {
          void getClient().then(sdk => sdk?.identify(...args));
        },
        reset: () => {
          void getClient().then(sdk => sdk?.reset());
        },
      }
    : undefined;
export default posthogClient;
