import type { PostHog } from "posthog-js";
import {
  PRIVACY_PREFERENCES_EVENT,
  analyticsConsentGranted,
} from "@/lib/privacy-consent";
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
          persistence: "localStorage",
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
          if (!analyticsConsentGranted()) return;
          void getClient().then(sdk => sdk?.capture(...args));
        },
        identify: (...args: Parameters<PostHog["identify"]>) => {
          if (!analyticsConsentGranted()) return;
          void getClient().then(sdk => sdk?.identify(...args));
        },
        reset: () => {
          void getClient().then(sdk => sdk?.reset());
        },
      }
    : undefined;
if (typeof window !== "undefined") {
  window.addEventListener(PRIVACY_PREFERENCES_EVENT, () => {
    if (!client) return;
    if (analyticsConsentGranted()) {
      void client.then(sdk => sdk?.opt_in_capturing());
    } else {
      void client.then(sdk => {
        sdk?.reset();
        sdk?.opt_out_capturing();
      });
    }
  });
}
export default posthogClient;
