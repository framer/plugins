import { beforeEach, describe, expect, it, type Mock, vi } from "vitest"
import { type Progress, TimeBasedAsyncProcessor } from "./AsyncProcessor"

describe("TimeBasedAsyncProcessor", () => {
    let processor: TimeBasedAsyncProcessor<string | undefined, string>
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

        processor = new TimeBasedAsyncProcessor<string | undefined, string>({
            blockLengthMs: 16,
        })

        processor.on("started", startedCallback)
        processor.on("progress", progressCallback)
        processor.on("completed", completedCallback)
        processor.on("error", errorCallback)
    })
    const items = ["wop", "bop", "Tutti frutti", "oh rootie"] as const
    const itemProcessor = (item: string | undefined): string => `processed-${item ?? "undefined"}`

    it("should process items and emit events in correct order", async () => {
        await processor.start(items, itemProcessor)

        expect(startedCallback).toHaveBeenCalledOnce()
        expect(progressCallback).toHaveBeenCalledExactlyOnceWith({
            results: ["processed-wop", "processed-bop", "processed-Tutti frutti", "processed-oh rootie"],
            isProcessing: false,
            progress: 1, // 4/4 = 1
            processedItems: 4,
            totalItems: 4,
            error: null,
        })

        expect(completedCallback).toHaveBeenCalledExactlyOnceWith([
            "processed-wop",
            "processed-bop",
            "processed-Tutti frutti",
            "processed-oh rootie",
        ])
        expect(errorCallback).not.toHaveBeenCalled()
    })

    it("should filter out undefined results", async () => {
        const caseItems = [...items, undefined]
        const filteringProcessor = (item: string | undefined): string | false =>
            item === undefined ? false : `processed-${item}`

        await processor.start(caseItems, filteringProcessor)

        expect(completedCallback).toHaveBeenCalledExactlyOnceWith([
            "processed-wop",
            "processed-bop",
            "processed-Tutti frutti",
            "processed-oh rootie",
        ])
    })

    it("should handle empty items array just fine", async () => {
        const emptyItems: string[] = []

        await processor.start(emptyItems, itemProcessor)

        expect(startedCallback).toHaveBeenCalled()
        expect(completedCallback).toHaveBeenCalled()
        expect(errorCallback).not.toHaveBeenCalled()
        expect(completedCallback).toHaveBeenCalledWith([])
    })

    describe("error handling", () => {
        it("should emit error event when processor throws", async () => {
            const errorProcessor = (item: string | undefined): string => {
                if (item === "bop") {
                    throw new Error("Processing failed")
                }
                return `processed-${item ?? "undefined"}`
            }

            await processor.start(items, errorProcessor)

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

            await processor.start(items, errorProcessor)

            expect(errorCallback).toHaveBeenCalledOnce()
            const error = errorCallback.mock.calls[0]?.[0]
            expect(error?.message).toBe("Unknown error")
        })
    })

    describe("abort functionality", () => {
        it("should abort processing without throwing", async () => {
            const processingPromise = processor.start(items, itemProcessor)
            processor.abort()

            await expect(processingPromise).resolves.toBeUndefined()
        })

        it("should handle abort during processing gracefully", async () => {
            const processingPromise = processor.start(items, itemProcessor)
            processor.abort()
            await processingPromise

            expect(errorCallback).not.toHaveBeenCalled()
        })
    })
})
