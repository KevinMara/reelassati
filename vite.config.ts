import path from "path";
const __dirname = import.meta.dirname;
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
  const plugins = [react()];

  // Production is bundled by scripts/build-server.mjs for Sites. In development,
  // run the same Worker, D1, and R2 boundary locally so browser checks exercise
  // real API behavior instead of Vite's SPA fallback returning index.html.
  if (command === "serve") {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(
      cloudflare({
        inspectorPort: false,
        persistState: { path: ".wrangler/state" },
        config: {
          topLevelName: "reelassati-local",
          name: "reelassati-local",
          main: "./sites/server.ts",
          // Keep local workerd on the newest date bundled with the pinned
          // Cloudflare tooling. Production keeps the Sites compatibility date.
          compatibility_date: "2026-05-22",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: [
            {
              binding: "DB",
              database_name: "reelassati-local",
              database_id: "00000000-0000-0000-0000-000000000001",
            },
          ],
          r2_buckets: [
            {
              binding: "BUCKET",
              bucket_name: "reelassati-local",
            },
          ],
          assets: {
            binding: "ASSETS",
            not_found_handling: "single-page-application",
            run_worker_first: ["/api/*"],
          },
        },
      })
    );
  }

  return {
    plugins,
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: ["terminal.local"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@contracts": path.resolve(__dirname, "./contracts"),
        "@db": path.resolve(__dirname, "./db"),
        db: path.resolve(__dirname, "./db"),
      },
    },
    envDir: path.resolve(__dirname),
    build: {
      outDir: path.resolve(__dirname, "dist/client"),
      emptyOutDir: true,
    },
  };
});
