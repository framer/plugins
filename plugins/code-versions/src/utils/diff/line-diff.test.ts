import { describe, expect, it } from "vitest"
import { getLineDiff } from "./line-diff"

describe("core functionality", () => {
    it("returns context lines for unchanged content", () => {
        const original = "line1\nline2\nline3"
        const revised = "line1\nline2\nline3"
        const result = getLineDiff(original, revised)

        expect(result).toEqual([
            { type: "context", content: "line1\n", oldLine: 1, newLine: 1 },
            { type: "context", content: "line2\n", oldLine: 2, newLine: 2 },
            { type: "context", content: "line3\n", oldLine: 3, newLine: 3 },
        ])
    })

    it("identifies added lines", () => {
        const original = "line1\nline3"
        const revised = "line1\nline2\nline3"
        const result = getLineDiff(original, revised)

        expect(result).toEqual([
            { type: "context", content: "line1\n", oldLine: 1, newLine: 1 },
            { type: "add", content: "line2\n", oldLine: null, newLine: 2 },
            { type: "context", content: "line3\n", oldLine: 2, newLine: 3 },
        ])
    })

    it("identifies removed lines", () => {
        const original = "line1\nline2\nline3"
        const revised = "line1\nline3"
        const result = getLineDiff(original, revised)

        expect(result).toEqual([
            { type: "context", content: "line1\n", oldLine: 1, newLine: 1 },
            { type: "remove", content: "line2\n", oldLine: 2, newLine: null },
            { type: "context", content: "line3\n", oldLine: 3, newLine: 2 },
        ])
    })

    it("pairs single-line changes with inline diffs", () => {
        const original = "line1\nold line\nline3"
        const revised = "line1\nnew line\nline3"
        const result = getLineDiff(original, revised)

        expect(result).toEqual([
            { type: "context", content: "line1\n", oldLine: 1, newLine: 1 },
            {
                type: "change",
                oldContent: "old line\n",
                newContent: "new line\n",
                oldLine: 2,
                newLine: 2,
                inlineDiffs: [
                    { type: "remove", value: "old" },
                    { type: "add", value: "new" },
                    { type: "unchanged", value: " line" },
                ],
            },
            { type: "context", content: "line3\n", oldLine: 3, newLine: 3 },
        ])
    })
})

describe("edge cases", () => {
    it("returns empty array for empty strings", () => {
        const result = getLineDiff("", "")
        expect(result).toEqual([])
    })

    it("handles single line addition", () => {
        const result = getLineDiff("", "new line")
        expect(result).toEqual([{ type: "add", content: "new line\n", oldLine: null, newLine: 1 }])
    })

    it("handles single line removal", () => {
        const result = getLineDiff("old line", "")
        expect(result).toEqual([{ type: "remove", content: "old line\n", oldLine: 1, newLine: null }])
    })
})

describe("whitespace handling", () => {
    it("preserves whitespace in unchanged lines", () => {
        const original = "  line1  \n  line2  \n"
        const revised = "  line1  \n  line2  \n"
        const result = getLineDiff(original, revised)

        expect(result).toEqual([
            { type: "context", content: "  line1  \n", oldLine: 1, newLine: 1 },
            { type: "context", content: "  line2  \n", oldLine: 2, newLine: 2 },
        ])
    })

    it("treats whitespace-only changes as changed", () => {
        const original = "line1\nline2"
        const revised = "line1\n  line2  "
        const result = getLineDiff(original, revised)

        expect(result).toHaveLength(2)
        expect(result[0]).toEqual({ type: "context", content: "line1\n", oldLine: 1, newLine: 1 })
        expect(result[1]).toHaveProperty("type", "change")

        if (result[1] && result[1].type === "change") {
            expect(result[1].oldContent).toContain("line2")
            expect(result[1].newContent).toContain("line2")
        }
    })
})
