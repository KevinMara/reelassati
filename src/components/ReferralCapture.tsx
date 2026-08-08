import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { platformApi } from "@/lib/platform-api";

export function ReferralCapture() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref")?.trim();
    if (!code) return;

    let active = true;
    void platformApi
      .claimReferral(code)
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        url.searchParams.delete("ref");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      });
    return () => {
      active = false;
    };
  }, [loading, user]);

  return null;
}
