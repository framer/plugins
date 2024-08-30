export default {
    extends: ["../../.eslintrc.common.js"],
    parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
    },
    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
    },
}
