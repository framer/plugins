import js from "@eslint/js"
import eslintPluginImportX from "eslint-plugin-import-x"
import * as reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import globals from "globals"
import * as tseslint from "typescript-eslint"

export default tseslint.config(
    { ignores: ["dist"] },
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs["recommended-latest"],
            reactRefresh.configs.vite,
            eslintPluginImportX.flatConfigs.recommended,
            eslintPluginImportX.flatConfigs.typescript,
        ],
        languageOptions: {
            globals: globals.browser,
        },
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            // Same as default, but combines regular and type imports
            "import-x/no-duplicates": ["error", { "prefer-inline": true }],
            // Same as default, but without blank lines between the groups
            "simple-import-sort/imports": ["error", { groups: [["^\\u0000"], ["^node:", "^@?\\w", "^", "^\\."]] }],
            "simple-import-sort/exports": "error",
        },
    }
)
