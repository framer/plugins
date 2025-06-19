import js from "@eslint/js"
import * as reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"
import * as tseslint from "typescript-eslint"

const JS_GLOB = "**/*.{,m,c}js{,x}"
const TS_GLOB = "**/*.{,d.}{,m,c}ts{,x}"
const JSX_GLOB = "**/*.{j,t}sx"
const JS_AND_TS_GLOBS = [JS_GLOB, TS_GLOB]

export default tseslint.config(
    {
        ignores: ["!**/*", "**/.git", "**/.turbo", "**/.yarn", "**/dist/*", "**/node_modules/*"],
    },

    {
        linterOptions: { reportUnusedDisableDirectives: true },
        languageOptions: { globals: globals.browser },
    },

    {
        files: [JSX_GLOB],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    },

    {
        files: JS_AND_TS_GLOBS,
        extends: [js.configs.recommended, reactHooks.configs["recommended-latest"], reactRefresh.configs.vite],
    },

    {
        files: JS_AND_TS_GLOBS,
        extends: [tseslint.configs.recommended],
        rules: {
            // Covered by TypeScript
            "@typescript-eslint/no-unused-vars": 0,
        },
    }
)
