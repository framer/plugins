import { describe, expect, it } from "vitest"
import { getLineDiff, getLineDiffWithEdges } from "./line-diff"
import { isDivider } from "./typeChecks.ts"

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

describe("divider generation", () => {
    it("generates dividers when changes are far apart", () => {
        const original = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10"
        const revised = "LINE1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nLINE10"

        const result = getLineDiffWithEdges(original, revised)

        const dividers = result.filter(isDivider)
        const changes = result.filter(l => l.type === "change")

        expect(dividers).toHaveLength(1)
        expect(changes).toHaveLength(2)

        expect(dividers[0]?.line).toEqual(6)
    })

    it("does not generate dividers for small changes with sufficient context", () => {
        const original = "line1\nline2\nline3\nline4\nline5"
        const revised = "line1\nline2\nLINE3\nline4\nline5"

        const result = getLineDiffWithEdges(original, revised)

        const dividers = result.filter(isDivider)
        expect(dividers).toHaveLength(0)
    })

    it("does not generate dividers for consecutive changes", () => {
        const original = "line1\nline2\nline3\nline4\nline5"
        const revised = "line1\nLINE2\nLINE3\nline4\nline5"

        const result = getLineDiffWithEdges(original, revised)

        const dividers = result.filter(isDivider)
        expect(dividers).toHaveLength(0)
    })

    it("handles mixed change types with dividers", () => {
        const original = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10"
        const revised = "line1\nLINE2\nline3\nline4\nline5\nline6\nline7\nline8\nLINE9\nline10"

        const result = getLineDiffWithEdges(original, revised)

        const dividers = result.filter(isDivider)
        const changes = result.filter(l => l.type === "change")

        expect(dividers).toHaveLength(1)
        expect(changes).toHaveLength(2)
    })

    it("generates dividers for large files with scattered changes", () => {
        const original = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join("\n")
        const revised = original
            .split("\n")
            .map((line, i) => {
                if (i === 5 || i === 25 || i === 45) {
                    return line.toUpperCase()
                }
                return line
            })
            .join("\n")

        const result = getLineDiffWithEdges(original, revised)

        const dividers = result.filter(l => l.type === "divider")
        const changes = result.filter(l => l.type === "change")

        expect(dividers.length).toEqual(2)
        expect(changes.length).toEqual(3)
    })
})

describe("getLineDiffWithEdges", () => {
    it("sets isTopEdge and isBottomEdge for single add", () => {
        const result = getLineDiffWithEdges("", "a\nb\nc")
        const adds = result.filter(l => l.type === "add")
        expect(adds.at(0)?.isTopEdge).toBe(true)
        expect(adds.at(-1)?.isBottomEdge).toBe(true)
    })

    it("sets only edges for consecutive adds", () => {
        const result = getLineDiffWithEdges("x\ny", "a\nb\nc\nx\ny")
        const adds = result.filter(l => l.type === "add")
        expect(adds.length).toBe(3)
        expect(adds[0]?.isTopEdge).toBe(true)
        expect(adds[0]?.isBottomEdge).toBe(false)
        expect(adds[1]?.isTopEdge).toBe(false)
        expect(adds[1]?.isBottomEdge).toBe(false)
        expect(adds[2]?.isTopEdge).toBe(false)
        expect(adds[2]?.isBottomEdge).toBe(true)
    })

    it("sets only edges for consecutive removes", () => {
        const result = getLineDiffWithEdges("a\nb\nc\nx\ny", "x\ny")
        const removes = result.filter(l => l.type === "remove")
        expect(removes.length).toBe(3)
        expect(removes[0]?.isTopEdge).toBe(true)
        expect(removes[0]?.isBottomEdge).toBe(false)
        expect(removes[1]?.isTopEdge).toBe(false)
        expect(removes[1]?.isBottomEdge).toBe(false)
        expect(removes[2]?.isTopEdge).toBe(false)
        expect(removes[2]?.isBottomEdge).toBe(true)
    })

    it("sets edges for change blocks", () => {
        const result = getLineDiffWithEdges("a\nb\nc", "a\nB\nc")
        const change = result.find(l => l.type === "change")
        expect(change?.removeIsTopEdge).toBe(true)
        expect(change?.removeIsBottomEdge).toBe(true)
        expect(change?.addIsTopEdge).toBe(true)
        expect(change?.addIsBottomEdge).toBe(true)
    })

    it("does not set edge props for context lines", () => {
        const result = getLineDiffWithEdges("a\nb", "a\nb")
        const context = result.find(l => l.type === "context")
        expect(context).not.toHaveProperty("isTopEdge")
        expect(context).not.toHaveProperty("isBottomEdge")
    })

    it("does not add border between remove and change blocks", () => {
        const result = getLineDiffWithEdges("a\nb\nc\nd", "a\nB\nd")
        const removeLines = result.filter(l => l.type === "remove")
        expect(removeLines.length).toBe(1)
        expect(removeLines[0]?.isTopEdge).toBe(false)
    })

    it("does not add border between change and add blocks", () => {
        const result = getLineDiffWithEdges("a\nb", "a\nB\nc\nd")
        const addLines = result.filter(l => l.type === "add")
        expect(addLines.length).toBe(2)
        expect(addLines[0]?.isTopEdge).toBe(false)
    })

    it("sets correct edges when a change block follows a change block", () => {
        // old: a\nb\nc\nd, new: a\nB\nC\nd
        const result = getLineDiffWithEdges("a\nb\nc\nd", "a\nB\nC\nd")
        const changes = result.filter(l => l.type === "change")
        expect(changes.length).toBe(2)

        expect(changes[0]?.addIsTopEdge).toBe(true)
        expect(changes[0]?.addIsBottomEdge).toBe(true)
    })
})
