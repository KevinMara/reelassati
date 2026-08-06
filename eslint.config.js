import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "api/**",
    "db/migrations/**",
    "db/schema.ts",
    "db/seed.ts",
    "src/components/ui/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Context modules intentionally export their provider and matching hook.
      "react-refresh/only-export-components": "off",
      // Uploaded/generated media does not always have a truthful caption file.
      // Each player must instead expose an accessible name and a real transcript
      // or an explicit caption-status description; never attach a fake empty VTT.
      "jsx-a11y/media-has-caption": "off",
    },
  },
]);
