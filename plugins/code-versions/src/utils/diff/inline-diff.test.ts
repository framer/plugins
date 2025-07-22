import { expect, it } from "vitest"
import { getInlineDiff } from "./inline-diff"

it("generates inline diffs for simple changes", () => {
    const result = getInlineDiff("hello world", "hello there")

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: "unchanged", value: "hello " })
    expect(result[1]).toEqual({ type: "remove", value: "world" })
    expect(result[2]).toEqual({ type: "add", value: "there" })
})

it("handles identical strings", () => {
    const result = getInlineDiff("same text", "same text")

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: "unchanged", value: "same text" })
})

it("handles completely different strings", () => {
    const result = getInlineDiff("old", "new")

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ type: "remove", value: "old" })
    expect(result[1]).toEqual({ type: "add", value: "new" })
})

it("does not highlight leading or trailing whitespace", () => {
    const result = getInlineDiff("  old line  ", "  new line  ")
    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ type: "unchanged", value: "  " })
    expect(result[1]).toEqual({ type: "remove", value: "old" })
    expect(result[2]).toEqual({ type: "add", value: "new" })
    expect(result[3]).toEqual({ type: "unchanged", value: " line" })
    expect(result[4]).toEqual({ type: "unchanged", value: "  " })
})

it("handles only whitespace changes as unchanged", () => {
    const result = getInlineDiff("  foo  ", "  foo  ")
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: "unchanged", value: "  " })
    expect(result[1]).toEqual({ type: "unchanged", value: "foo" })
    expect(result[2]).toEqual({ type: "unchanged", value: "  " })
})
