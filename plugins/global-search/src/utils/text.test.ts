import { describe, expect, it } from "vitest"
import { truncateFromStart } from "./text"

describe("truncateFromStart", () => {
    const text = "We worked so hard and came so far but nothing really mattered"

    it("returns original text when shorter than maxLength", () => {
        expect(truncateFromStart("We tried so hard", 20)).toBe("We tried so hard")
        expect(truncateFromStart("short", 10)).toBe("short")
    })

    it("truncates from start with ellipsis", () => {
        const result = truncateFromStart(text, 20)
        expect(result.length).toBeLessThanOrEqual(21) // 20 chars + ellipsis
        expect(result.startsWith("…")).toBe(true)
        expect(result).toContain("really mattered")
    })

    it("breaks at word boundary when possible", () => {
        const result = truncateFromStart("We worked so hard and came so far", 20)
        expect(result).toBe("…and came so far")
    })

    it("handles text with no spaces", () => {
        const result = truncateFromStart(text.replaceAll(" ", "-"), 10)
        expect(result).toBe("…y-mattered")
    })

    it("uses custom ellipsis", () => {
        const result = truncateFromStart(text, 20, { ellipsis: "###" })
        expect(result).toContain("###")
    })

    it("handles empty string", () => {
        expect(truncateFromStart("", 10)).toBe("")
    })
})
