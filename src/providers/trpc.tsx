import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {};

        // ── JWT Token (Google OAuth) ──────────────────────────────────────
        const token = localStorage.getItem("reelassati_token");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
          return headers;
        }

        // ── Legacy local auth ─────────────────────────────────────────────
        const authData = localStorage.getItem("reelassati_auth");
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            headers["x-auth-user-id"] = String(parsed.id || "");
            headers["x-auth-email"] = parsed.email || "";
          } catch { /* ignore */ }
        }

        // ── Also check localStorage user fallback ─────────────────────────
        if (!headers["x-auth-user-id"]) {
          const userData = localStorage.getItem("reelassati_user");
          if (userData) {
            try {
              const parsed = JSON.parse(userData);
              headers["x-auth-user-id"] = String(parsed.id || "");
              headers["x-auth-email"] = parsed.email || "";
            } catch { /* ignore */ }
          }
        }

        return headers;
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
