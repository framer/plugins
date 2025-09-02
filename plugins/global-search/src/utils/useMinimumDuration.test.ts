import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useMinimumDuration } from "./useMinimumDuration"

function advanceTimersByTime(time: number) {
    act(() => {
        vi.advanceTimersByTime(time)
    })
}

describe("useMinimumDuration", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
    })

    it("should delay returning false when input becomes false", () => {
        const { result, rerender } = renderHook(({ value }) => useMinimumDuration(value, 1000), {
            initialProps: { value: true },
        })

        expect(result.current).toBe(true)

        rerender({ value: false })
        expect(result.current).toBe(true)

        advanceTimersByTime(500)

        expect(result.current).toBe(true)

        advanceTimersByTime(500)

        expect(result.current).toBe(false)
    })

    it("should cancel delay when input becomes true again during delay period", () => {
        const { result, rerender } = renderHook(({ value }) => useMinimumDuration(value, 1000), {
            initialProps: { value: true },
        })

        expect(result.current).toBe(true)

        rerender({ value: false })
        expect(result.current).toBe(true)

        advanceTimersByTime(500)

        expect(result.current).toBe(true)

        rerender({ value: true })
        expect(result.current).toBe(true)

        advanceTimersByTime(600)

        expect(result.current).toBe(true)

        rerender({ value: false })
        expect(result.current).toBe(true)

        advanceTimersByTime(1000)

        expect(result.current).toBe(false)
    })

    it("should handle multiple rapid changes correctly", () => {
        const { result, rerender } = renderHook(({ value }) => useMinimumDuration(value, 1000), {
            initialProps: { value: false },
        })

        expect(result.current).toBe(false)

        rerender({ value: true })
        expect(result.current).toBe(true)

        rerender({ value: false })
        expect(result.current).toBe(true)

        rerender({ value: true })
        expect(result.current).toBe(true)

        rerender({ value: false })
        expect(result.current).toBe(true)

        advanceTimersByTime(1000)

        expect(result.current).toBe(false)
    })

    it("should clean up timeout on unmount to prevent memory leaks", () => {
        const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

        const { unmount, rerender } = renderHook(({ value }) => useMinimumDuration(value, 1000), {
            initialProps: { value: true },
        })

        rerender({ value: false })
        unmount()

        expect(clearTimeoutSpy).toHaveBeenCalled()

        clearTimeoutSpy.mockRestore()
    })
})
