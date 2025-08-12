import { describe, expect, it } from "vitest"
import { findRanges } from "./ranges"

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
