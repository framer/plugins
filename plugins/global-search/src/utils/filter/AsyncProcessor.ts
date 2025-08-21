import { type EventMap, TypedEventEmitter } from "../event-emitter"

export interface AsyncProcessorOptions {
    readonly blockLengthMs?: number
}

export interface Progress<TOutput> {
    readonly results: readonly TOutput[]
    readonly isProcessing: boolean
    /** Processing progress as a ratio (0-1) */
    readonly progress: number
    /** Number of items processed so far */
    readonly processedItems: number
    /** Total number of items to process */
    readonly totalItems: number
    readonly error: Error | null
}

export interface AsyncProcessorEvents<TOutput> extends EventMap {
    started: never
    progress: Progress<TOutput>
    completed: readonly TOutput[]
    error: Error
}

const setIdleCallback = "requestIdleCallback" in window ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 1)

function waitForIdle(): Promise<void> {
    return new Promise(resolve => {
        setIdleCallback(() => {
            resolve()
        })
    })
}

export class TimeBasedAsyncProcessor<TInput, TOutput> {
    private abortController: AbortController | null = null
    private events = new TypedEventEmitter<AsyncProcessorEvents<TOutput>>()
    private blockLengthMs: number

    public on: typeof this.events.on = (...args) => this.events.on(...args)

    constructor({
        // This could be 16ms, which comes down to 1000ms / 60fps
        // Or, if you're living the future™ on a 120hz monitor, you could use 8ms (or 7 to allow room for UI updates)
        // We are living in the future™ today.
        blockLengthMs = 7,
    }: AsyncProcessorOptions = {}) {
        this.blockLengthMs = blockLengthMs
    }

    private emitProgressUpdate(
        results: readonly TOutput[],
        processedItems: number,
        totalItems: number,
        isProcessing: boolean
    ): void {
        const progress = totalItems > 0 ? processedItems / totalItems : 0
        this.events.emit("progress", {
            results,
            isProcessing,
            progress,
            processedItems,
            totalItems,
            error: null,
        })
    }

    /**
     * Start processing items. Can be called again with a new set of items.
     *
     * Using a class/method construct here to have the ability to encapsulate all the logic in a simpler interface, while it all could be done with other ways, this is a clearer interface
     */
    async start(items: readonly TInput[], itemProcessor: (item: TInput) => TOutput | false): Promise<void> {
        this.abort()

        this.events.emit("started")

        const abortController = new AbortController()
        this.abortController = abortController

        const results: TOutput[] = []
        let currentIndex = 0

        try {
            while (currentIndex < items.length) {
                if (abortController.signal.aborted) return

                const blockStart = performance.now()

                while (currentIndex < items.length && performance.now() - blockStart < this.blockLengthMs) {
                    const item = items[currentIndex]
                    if (item !== undefined) {
                        const result = itemProcessor(item)
                        if (result !== false) {
                            results.push(result)
                        }
                    }
                    currentIndex++
                }

                const isProcessing = currentIndex < items.length
                this.emitProgressUpdate(results, currentIndex, items.length, isProcessing)

                if (isProcessing) {
                    await waitForIdle()
                }
            }
            this.events.emit("completed", results)
        } catch (error: unknown) {
            if (abortController.signal.aborted) return

            this.events.emit("error", error instanceof Error ? error : new Error("Unknown error", { cause: error }))
        }
    }

    abort(): void {
        this.abortController?.abort()
        this.abortController = null
    }
}
