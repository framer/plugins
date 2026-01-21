import { describe, expect, it } from "vitest"
import { extractLocation } from "./dataSources"

describe("extractLocation", () => {
    it("extracts location with full address", () => {
        const result = extractLocation("San Francisco", {
            postalAddress: {
                addressLocality: "San Francisco",
                addressRegion: "CA",
                addressCountry: "USA",
            },
        })

        expect(result).toEqual({
            id: "san-francisco",
            name: "San Francisco",
            locality: "San Francisco",
            region: "CA",
            country: "USA",
            fullAddress: "San Francisco, CA, USA",
        })
    })

    it("handles null address", () => {
        const result = extractLocation("Remote", null)

        expect(result).toEqual({
            id: "remote",
            name: "Remote",
            locality: "",
            region: "",
            country: "",
            fullAddress: "",
        })
    })

    it("handles partial address", () => {
        const result = extractLocation("Berlin", {
            postalAddress: {
                addressCountry: "Germany",
            },
        })

        expect(result).toEqual({
            id: "berlin",
            name: "Berlin",
            locality: "",
            region: "",
            country: "Germany",
            fullAddress: "Germany",
        })
    })

    it("deduplicates address parts", () => {
        const result = extractLocation("California", {
            postalAddress: {
                addressLocality: "CA",
                addressRegion: "CA",
                addressCountry: "USA",
            },
        })

        expect(result.fullAddress).toBe("CA, USA")
    })

    it("trims whitespace from address parts", () => {
        const result = extractLocation("New York", {
            postalAddress: {
                addressLocality: "  New York  ",
                addressRegion: "  NY  ",
                addressCountry: "  USA  ",
            },
        })

        expect(result.locality).toBe("New York")
        expect(result.region).toBe("NY")
        expect(result.country).toBe("USA")
    })

    it("handles non-ASCII location names", () => {
        const result = extractLocation("東京", {
            postalAddress: {
                addressCountry: "Japan",
            },
        })

        expect(result.id).toBe("東京")
        expect(result.name).toBe("東京")
    })
})
