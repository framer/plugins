import { describe, expect, it } from "vitest"
import { findRanges, rangeToCodeFileLocation } from "./ranges"

describe("findRanges", () => {
    it("should return an empty array if the text is empty", () => {
        expect(findRanges("", "test", false)).toEqual([])
    })

    it("should have a match of the query in the text", () => {
        expect(findRanges("I'm not sure all these people understand", "people", false)).toEqual([[23, 29]])
    })

    it("should return multiple matches of the query in the text", () => {
        expect(findRanges("Nightswimming deserves a quiet night\nDeserves a quiet night", "quiet", false)).toEqual([
            [25, 30],
            [48, 53],
        ])
    })

    it("should not return a match if the (case-sensitive) query is not in the text", () => {
        expect(findRanges("September's coming soon", "COMING", true)).toEqual([])
    })

    it("should return a match if the (case-insensitive) query is in the text", () => {
        expect(findRanges("I'm pining for the moon", "MOON", false)).toEqual([[19, 23]])
    })
})

describe("rangeToCodeFileLocation", () => {
    it("should convert range at start of single line text", () => {
        const text = "hello world"
        const range: readonly [number, number] = [0, 5]

        expect(rangeToCodeFileLocation(range, text)).toEqual({
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 6,
        })
    })

    it("should convert range in middle of single line text", () => {
        const text = "hello world"
        const range: readonly [number, number] = [6, 11]

        expect(rangeToCodeFileLocation(range, text)).toEqual({
            startLine: 1,
            startColumn: 7,
            endLine: 1,
            endColumn: 12,
        })
    })

    it("should convert range spanning multiple lines", () => {
        const text = "first line\nsecond line\nthird line"
        const range: readonly [number, number] = [6, 18]

        expect(rangeToCodeFileLocation(range, text)).toEqual({
            startLine: 1,
            startColumn: 7,
            endLine: 2,
            endColumn: 8,
        })
    })

    it("should convert range starting on second line", () => {
        const text = "first line\nsecond line"
        const range: readonly [number, number] = [11, 17]

        expect(rangeToCodeFileLocation(range, text)).toEqual({
            startLine: 2,
            startColumn: 1,
            endLine: 2,
            endColumn: 7,
        })
    })
})
