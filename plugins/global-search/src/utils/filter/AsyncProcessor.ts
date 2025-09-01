import { type EventMap, TypedEventEmitter } from "../event-emitter"
import { waitForIdle } from "../idle-utils"

export interface ResumableAsyncIterable<T extends { id: string }> {
    iterateFrom(lastKey: string | null): AsyncGenerator<T, unknown, T>
}

export interface Progress<TOutput> {
    readonly results: readonly TOutput[]
    readonly processedItems: number
    readonly error: Error | null
}

export interface AsyncProcessorEvents<TOutput> extends EventMap {
    started: never
    progress: Progress<TOutput>
    completed: readonly TOutput[]
    error: Error
}

export class IdleCallbackAsyncProcessor<TOutput> {
    private abortController: AbortController | null = null
    private events = new TypedEventEmitter<AsyncProcessorEvents<TOutput>>()

    public on: typeof this.events.on = (...args) => this.events.on(...args)

    private emitProgressUpdate(results: readonly TOutput[], processedItems: number): void {
        this.events.emit("progress", {
            results,
            processedItems,
            error: null,
        })
    }

    /**
     * Start processing items from a resumable async iterable using requestIdleCallback deadline management.
     * More memory efficient for large datasets and respects browser scheduling.
     *
     * The iterator is "resumable" to not run into issues with transactions stretching across idle callbacks.
     */
    async start<TInput extends { id: string }>(
        items: ResumableAsyncIterable<TInput>,
        itemProcessor: (item: TInput) => TOutput | false
    ): Promise<void> {
        this.abort()

        this.events.emit("started")

        const abortController = new AbortController()
        this.abortController = abortController

        const results: TOutput[] = []
        let processedItems = 0
        let lastProcessedKey: string | null = null

        try {
            while (true) {
                if (abortController.signal.aborted) return

                // Wait for idle time before starting processing
                const deadline = await waitForIdle()

                // Start a new iterator from where we left off
                const iterator = items.iterateFrom(lastProcessedKey)
                const currentIterator = iterator[Symbol.asyncIterator]()

                try {
                    // Process items until the browser's idle deadline is reached
                    while (deadline.timeRemaining() > 0) {
                        const { value, done } = await currentIterator.next()

                        if (done) {
                            this.emitProgressUpdate(results, processedItems)
                            this.events.emit("completed", results)
                            return
                        }

                        const result = itemProcessor(value)
                        if (result !== false) {
                            results.push(result)
                        }

                        // Track the last processed key for resumption
                        lastProcessedKey = value.id
                        processedItems++
                    }

                    // Deadline reached, emit progress if we processed any items

                    this.emitProgressUpdate(results, processedItems)
                } finally {
                    await currentIterator.return(undefined)
                }
            }
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
