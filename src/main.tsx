import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { TRPCProvider } from "@/providers/trpc";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import "@/lib/i18n";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <TRPCProvider>
        <App />
        <Analytics />
      </TRPCProvider>
    </HashRouter>
  </StrictMode>
);
