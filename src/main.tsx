import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { initializeI18n } from "@/lib/i18n";
import App from "./App";

void initializeI18n().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>
  );
});
