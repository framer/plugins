import { describe, expect, it } from "vitest"
import { stripMarkup } from "./strip-markup"

describe("stripMarkup(text)", () => {
    it("should strip markup from a string", () => {
        expect(stripMarkup("<b>Cause it's a</b> bittersweet symphony, this life")).toBe(
            "Cause it's a bittersweet symphony, this life"
        )
    })

    it("should strip multiple tags", () => {
        expect(stripMarkup("<b>Try to make ends meet</b> <i>you're a slave to money</i> then you die")).toBe(
            "Try to make ends meet you're a slave to money then you die"
        )
    })

    it("should strip nested tags", () => {
        expect(stripMarkup("<b><i>I'll take you down the only road I've ever been down</i></b>")).toBe(
            "I'll take you down the only road I've ever been down"
        )
    })

    it("should handle plain text without HTML tags (optimized path)", () => {
        expect(stripMarkup("No change, I can't change")).toBe("No change, I can't change")
        expect(stripMarkup("")).toBe("")
        expect(stripMarkup("I can't change, but I'm here in my mold")).toBe("I can't change, but I'm here in my mold")
    })

    it("should decode HTML entities", () => {
        expect(stripMarkup("Bitter &amp; sweet symphony")).toBe("Bitter & sweet symphony")
        expect(stripMarkup("&lt;music&gt;")).toBe("<music>")
        expect(stripMarkup("&quot;Try to make ends meet&quot;")).toBe('"Try to make ends meet"')
        expect(stripMarkup("&nbsp;You're a slave to money&nbsp;")).toBe("You're a slave to money")
    })

    it("should handle mixed content with tags and entities", () => {
        expect(stripMarkup("<p>Cause it's a &amp; <b>bittersweet</b> symphony</p>")).toBe(
            "Cause it's a & bittersweet symphony"
        )
    })

    it("should clean up extra whitespace", () => {
        expect(stripMarkup("<p>  I can't change   <b>but I'm here</b>  </p>")).toBe("I can't change but I'm here")
        expect(stripMarkup("Try to make\n\n\nends meet")).toBe("Try to make ends meet")
    })

    it("should handle complex HTML structures (fallback to DOMParser)", () => {
        expect(stripMarkup("<div><p>Only road <span>I've ever <em>been down</em></span></p></div>")).toBe(
            "Only road I've ever been down"
        )
    })

    it("should handle self-closing tags", () => {
        expect(stripMarkup("Try to make<br/>ends meet")).toBe("Try to make ends meet")
        expect(stripMarkup("Image: <img src='test.jpg' alt='test'/>")).toBe("Image:")
    })
})
