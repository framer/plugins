import { describe, expect, it } from "vitest"
import { slugify } from "./dataSources"

describe("slugify", () => {
    it("converts to lowercase", () => {
        expect(slugify("New York")).toBe("new-york")
    })

    it("replaces spaces with hyphens", () => {
        expect(slugify("san francisco")).toBe("san-francisco")
    })

    it("removes special characters", () => {
        expect(slugify("New York, NY")).toBe("new-york-ny")
    })

    it("trims whitespace", () => {
        expect(slugify("  Berlin  ")).toBe("berlin")
    })

    it("handles multiple spaces and hyphens", () => {
        expect(slugify("Los   Angeles - CA")).toBe("los-angeles-ca")
    })

    it("preserves non-ASCII letters", () => {
        expect(slugify("São Paulo")).toBe("são-paulo")
        expect(slugify("München")).toBe("münchen")
        expect(slugify("東京")).toBe("東京")
        expect(slugify("Zürich")).toBe("zürich")
    })

    it("handles mixed ASCII and non-ASCII", () => {
        expect(slugify("Köln, Germany")).toBe("köln-germany")
    })

    it("returns empty string for empty input", () => {
        expect(slugify("")).toBe("")
    })

    it("handles numbers", () => {
        expect(slugify("Area 51")).toBe("area-51")
    })
})
