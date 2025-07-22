import { describe, expect, it } from "vitest"
import { formatRelative } from "./date"

describe("formatRelative", () => {
    it("formats seconds ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 30 * 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("Just now")
    })

    it("formats 1 second ago", () => {
        const now = new Date()
        const date = new Date(now.getTime() - 1000)
        expect(formatRelative(now, date, "en-GB")).toEqual("Just now")
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
