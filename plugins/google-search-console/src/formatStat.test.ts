import { describe, expect, it } from "vitest"
import { formatStat } from "./formatStat"

describe("formatStat", () => {
    it("keeps values below one thousand unchanged", () => {
        expect(formatStat(0)).toBe("0")
        expect(formatStat(12)).toBe("12")
        expect(formatStat(999)).toBe("999")
    })

    it("abbreviates large values with one decimal place", () => {
        expect(formatStat(1000)).toBe("1K")
        expect(formatStat(1234)).toBe("1.2K")
        expect(formatStat(10_500)).toBe("10.5K")
        expect(formatStat(1_200_000)).toBe("1.2M")
    })

    it("carries rounded values into the next unit", () => {
        expect(formatStat(999_950)).toBe("1M")
    })

    it("preserves negative values", () => {
        expect(formatStat(-1234)).toBe("-1.2K")
    })

    it("returns a dash for non-finite values", () => {
        expect(formatStat(Number.POSITIVE_INFINITY)).toBe("—")
        expect(formatStat(Number.NaN)).toBe("—")
    })
})
