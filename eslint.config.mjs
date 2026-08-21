import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".desktop-user-data/**", ".next/**", ".npm-cache/**", "coverage/**", "dist/**", "node_modules/**", "public/**", "data/**", "logs/**"]
  },
  { ...js.configs.recommended, files: ["**/*.{js,mjs}"] },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.{ts,tsx,mts}"] })),
  { ...reactHooks.configs.flat.recommended, files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"] },
  { ...jsxA11y.flatConfigs.recommended, files: ["app/**/*.tsx", "components/**/*.tsx"] },
  {
    files: ["**/*.{js,mjs,ts,tsx,mts}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "jsx-a11y/label-has-associated-control": ["error", {
        assert: "either",
        controlComponents: ["HistoryCurrencySelect", "ValuationSourceSelect"],
        depth: 4
      }]
    }
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  }
);
