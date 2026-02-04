import { describe, expect, it } from "vitest"
import { ensureExtension, isSupportedExtension, normalizePath, sanitizeFilePath } from "./paths.ts"

describe("File Name Sanitization", () => {
    describe("sanitizeFilePath", () => {
        it("replaces invalid characters with underscores", () => {
            const result = sanitizeFilePath("bad name!.tsx")
            expect(result.path).toBe("Bad_name_.tsx")
            expect(result.name).toBe("Bad_name_")
        })

        it("prefixes names starting with numbers", () => {
            const result = sanitizeFilePath("123Component.tsx")
            expect(result.name).toMatch(/^\$/)
        })

        it("capitalizes React component names (.tsx)", () => {
            const result = sanitizeFilePath("myComponent.tsx")
            expect(result.name).toBe("MyComponent")
            expect(result.path).toBe("MyComponent.tsx")
        })

        it("preserves lowercase for non-component files (.ts)", () => {
            const result = sanitizeFilePath("utils.ts", false)
            expect(result.name).toBe("utils")
            expect(result.path).toBe("utils.ts")
        })

        it("preserves lowercase for .json files", () => {
            const result = sanitizeFilePath("config.json", false)
            expect(result.name).toBe("config")
            expect(result.path).toBe("config.json")
        })

        it("handles nested directory paths", () => {
            const result = sanitizeFilePath("components/ui/Button.tsx")
            expect(result.dirName).toBe("components/ui")
            expect(result.name).toBe("Button")
            expect(result.path).toBe("components/ui/Button.tsx")
        })

        it("sanitizes directory names with invalid characters", () => {
            const result = sanitizeFilePath("my folder!/Component.tsx")
            expect(result.dirName).toBe("my_folder_")
            expect(result.path).toBe("my_folder_/Component.tsx")
        })

        it("collapses multiple underscores", () => {
            const result = sanitizeFilePath("bad___name.tsx")
            expect(result.name).toBe("Bad_name")
        })

        it("handles empty input gracefully", () => {
            const result = sanitizeFilePath("")
            expect(result.name).toBe("MyComponent")
        })

        it("preserves extension in result", () => {
            const result = sanitizeFilePath("Test.tsx")
            expect(result.extension).toBe("tsx")
        })
    })

    describe("Extension Handling", () => {
        it("recognizes .tsx as supported", () => {
            expect(isSupportedExtension("Component.tsx")).toBe(true)
        })

        it("recognizes .ts as supported", () => {
            expect(isSupportedExtension("utils.ts")).toBe(true)
        })

        it("recognizes .jsx as supported", () => {
            expect(isSupportedExtension("Component.jsx")).toBe(true)
        })

        it("recognizes .js as supported", () => {
            expect(isSupportedExtension("script.js")).toBe(true)
        })

        it("recognizes .json as supported", () => {
            expect(isSupportedExtension("data.json")).toBe(true)
        })

        it("rejects .txt as unsupported", () => {
            expect(isSupportedExtension("readme.txt")).toBe(false)
        })

        it("rejects .md as unsupported", () => {
            expect(isSupportedExtension("README.md")).toBe(false)
        })

        it("rejects .css as unsupported", () => {
            expect(isSupportedExtension("styles.css")).toBe(false)
        })

        it("is case-insensitive for extensions", () => {
            expect(isSupportedExtension("Component.TSX")).toBe(true)
            expect(isSupportedExtension("utils.TS")).toBe(true)
        })
    })

    describe("Path Normalization", () => {
        it("normalizes backslashes to forward slashes", () => {
            expect(normalizePath("foo\\bar\\baz.tsx")).toBe("foo/bar/baz.tsx")
        })

        it("removes redundant slashes", () => {
            expect(normalizePath("foo//bar///baz.tsx")).toBe("foo/bar/baz.tsx")
        })

        it("resolves . segments", () => {
            expect(normalizePath("foo/./bar/baz.tsx")).toBe("foo/bar/baz.tsx")
        })

        it("resolves .. segments", () => {
            expect(normalizePath("foo/bar/../baz.tsx")).toBe("foo/baz.tsx")
        })

        it("preserves absolute paths", () => {
            expect(normalizePath("/foo/bar")).toBe("/foo/bar")
        })
    })

    describe("ensureExtension", () => {
        it("adds .tsx extension when missing", () => {
            expect(ensureExtension("Component")).toBe("Component.tsx")
        })

        it("preserves existing .tsx extension", () => {
            expect(ensureExtension("Component.tsx")).toBe("Component.tsx")
        })

        it("preserves existing .ts extension", () => {
            expect(ensureExtension("utils.ts")).toBe("utils.ts")
        })

        it("preserves existing .json extension", () => {
            expect(ensureExtension("data.json")).toBe("data.json")
        })

        it("allows custom default extension", () => {
            expect(ensureExtension("utils", ".ts")).toBe("utils.ts")
        })
    })
})
