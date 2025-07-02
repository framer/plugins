import { describe, expect, it } from "vitest"
import { formatFull, formatRelative } from "./date"

describe("formatRelative", () => {
    it("formats seconds ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 30 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("30s ago")
    })

    it("formats 1 second ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("1s ago")
    })

    it("formats minutes ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 5 * 60 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("5m ago")
    })

    it("formats 1 minute ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 60 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("1m ago")
    })

    it("formats hours ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 3 * 60 * 60 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("3h ago")
    })

    it("formats 1 hour ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 60 * 60 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("1h ago")
    })

    it("formats days ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("3d ago")
    })

    it("formats 1 day ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("1d ago")
    })

    it("formats dates older than 7 days as locale date", () => {
        const now = new Date("2025-07-02T00:00:00")
        const date = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
        const result = formatRelative(now, date, "en-GB")
        expect(result).toEqual("22/06/2025")
    })
})

describe("formatFull", () => {
    it("formats date with time correctly", () => {
        expect(formatFull("2025-07-02T14:30:00", "en-GB")).toEqual("02/07/25 • 14:30")
    })

    it("accepts a string date", () => {
        expect(formatFull("2025-07-02T14:30:00", "en-GB")).toEqual("02/07/25 • 14:30")
    })

    it("handles single digit month and day", () => {
        expect(formatFull("2025-07-02T09:05:00", "en-GB")).toEqual("02/07/25 • 09:05")
    })

    it("handles different years", () => {
        expect(formatFull("2024-06-15T16:45:00", "en-GB")).toEqual("15/06/24 • 16:45")
    })

    it("handles midnight", () => {
        expect(formatFull("2025-07-02T00:00:00", "en-GB")).toEqual("02/07/25 • 00:00")
    })

    it("handles noon", () => {
        expect(formatFull("2025-07-02T12:00:00", "en-GB")).toEqual("02/07/25 • 12:00")
    })

    it("handles end of year", () => {
        expect(formatFull("2025-07-02T23:59:00", "en-GB")).toEqual("02/07/25 • 23:59")
    })

    it("formats with en-US locale", () => {
        // puts the month first, day second, year last
        expect(formatFull("2025-07-02T14:30:00", "en-US")).toEqual("07/02/25 • 02:30 pm")
    })
})
