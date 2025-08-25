import { beforeEach, describe, expect, it, type Mock, vi } from "vitest"
import { IdleCallbackAsyncProcessor, type Progress, type ResumableAsyncIterable } from "./AsyncProcessor"

// Simple test wrapper to make arrays work with ResumableAsyncIterable
class TestAsyncIterable<T extends { id: string }> implements ResumableAsyncIterable<T> {
    constructor(private items: readonly T[]) {}

    async *iterateFrom(startKey: string | null): AsyncGenerator<T> {
        const startIndex = startKey ? this.items.findIndex(item => item.id === startKey) + 1 : 0
        for (let i = startIndex; i < this.items.length; i++) {
            const item = this.items[i]
            if (item) {
                // Add a minimal await to satisfy the linter
                await Promise.resolve()
                yield item
            }
        }
    }
}

describe("IdleCallbackAsyncProcessor", () => {
    let processor: IdleCallbackAsyncProcessor<string>

    let startedCallback: Mock<() => void>
    let progressCallback: Mock<(progress: Progress<string>) => void>
    let completedCallback: Mock<(results: readonly string[]) => void>
    let errorCallback: Mock<(error: Error) => void>

    beforeEach(() => {
        vi.clearAllMocks()

        startedCallback = vi.fn()
        progressCallback = vi.fn()
        completedCallback = vi.fn()
        errorCallback = vi.fn()

        processor = new IdleCallbackAsyncProcessor<string>()

        processor.on("started", startedCallback)
        processor.on("progress", progressCallback)
        processor.on("completed", completedCallback)
        processor.on("error", errorCallback)
    })

    const items = [
        { id: "1", value: "wop" },
        { id: "2", value: "bop" },
        { id: "3", value: "Tutti frutti" },
        { id: "4", value: "oh rootie" },
    ] as const

    const itemProcessor = (item: { id: string; value: string }): string => `processed-${item.value}`

    it("should work with test async generator", async () => {
        const testIterable = new TestAsyncIterable(items)
        const results = []

        for await (const item of testIterable.iterateFrom(null)) {
            results.push(item)
        }

        expect(results).toEqual(items)
    })

    it("should emit started event", async () => {
        const testIterable = new TestAsyncIterable([])

        const promise = processor.start(testIterable, itemProcessor)

        // Check if started was called immediately
        expect(startedCallback).toHaveBeenCalledOnce()

        await promise
    })

    it("should process items and emit events in correct order", async () => {
        const testIterable = new TestAsyncIterable(items)
        await processor.start(testIterable, itemProcessor)

        expect(startedCallback).toHaveBeenCalledOnce()
        expect(errorCallback).not.toHaveBeenCalled()

        // Should complete successfully
        expect(completedCallback).toHaveBeenCalledWith([
            "processed-wop",
            "processed-bop",
            "processed-Tutti frutti",
            "processed-oh rootie",
        ])

        // Should emit at least one progress event during processing
        expect(progressCallback).toHaveBeenCalled()

        // Check that progress was reported
        const progressCalls = progressCallback.mock.calls
        expect(progressCalls.length).toBeGreaterThan(0)

        // Check final progress contains all results
        const finalProgressCall = progressCalls[progressCalls.length - 1]?.[0]
        expect(finalProgressCall?.results).toEqual([
            "processed-wop",
            "processed-bop",
            "processed-Tutti frutti",
            "processed-oh rootie",
        ])
    })

    it("should filter out false results", async () => {
        const filteringProcessor = (item: { id: string; value: string }): string | false =>
            item.value === "bop" ? false : `processed-${item.value}`

        const testIterable = new TestAsyncIterable(items)
        await processor.start(testIterable, filteringProcessor)

        expect(completedCallback).toHaveBeenCalledWith([
            "processed-wop",
            "processed-Tutti frutti",
            "processed-oh rootie",
        ])
    })

    it("should handle empty items array just fine", async () => {
        const emptyItems: { id: string; value: string }[] = []
        const emptyIterable = new TestAsyncIterable(emptyItems)

        await processor.start(emptyIterable, itemProcessor)

        expect(startedCallback).toHaveBeenCalled()
        expect(completedCallback).toHaveBeenCalled()
        expect(errorCallback).not.toHaveBeenCalled()
        expect(completedCallback).toHaveBeenCalledWith([])

        // With empty items, we should get minimal progress updates
        expect(progressCallback).toHaveBeenCalled()
    })

    describe("error handling", () => {
        it("should emit error event when processor throws", async () => {
            const errorProcessor = (item: { id: string; value: string }): string => {
                if (item.value === "bop") {
                    throw new Error("Processing failed")
                }
                return `processed-${item.value}`
            }

            const testIterable = new TestAsyncIterable(items)
            await processor.start(testIterable, errorProcessor)

            expect(errorCallback).toHaveBeenCalledOnce()
            const error = errorCallback.mock.calls[0]?.[0]
            expect(error?.message).toBe("Processing failed")
            expect(completedCallback).not.toHaveBeenCalled()
        })

        it("should handle non-Error exceptions", async () => {
            const errorProcessor = () => {
                // Hold my soda, I know what I'm doing
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw "String error"
            }

            const testIterable = new TestAsyncIterable(items)
            await processor.start(testIterable, errorProcessor)

            expect(errorCallback).toHaveBeenCalledOnce()
            const error = errorCallback.mock.calls[0]?.[0]
            expect(error?.message).toBe("Unknown error")
        })
    })

    describe("abort functionality", () => {
        it("should abort processing without throwing", async () => {
            const testIterable = new TestAsyncIterable(items)
            const processingPromise = processor.start(testIterable, itemProcessor)
            processor.abort()

            await expect(processingPromise).resolves.toBeUndefined()
        })

        it("should handle abort during processing gracefully", async () => {
            const testIterable = new TestAsyncIterable(items)
            const processingPromise = processor.start(testIterable, itemProcessor)
            processor.abort()
            await processingPromise

            expect(errorCallback).not.toHaveBeenCalled()
        })
    })
})
