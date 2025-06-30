import { framer } from "framer-plugin"
import { isCanvasNode } from "./traits"
import type { CanvasNode, Result } from "./types"

interface BatchProcessResultsOptions {
    process: (result: Result, node: CanvasNode, index: number) => Promise<void>
    onStarted: () => void
    onProgress: (count: number, total: number) => void
    onCompleted: () => void
}

export class BatchProcessResults {
    private ready: boolean = false
    private started: boolean = false
    private batchSize: number = 10
    private process: BatchProcessResultsOptions["process"]
    private onStarted: BatchProcessResultsOptions["onStarted"]
    private onProgress: BatchProcessResultsOptions["onProgress"]
    private onCompleted: BatchProcessResultsOptions["onCompleted"]

    constructor(options: BatchProcessResultsOptions) {
        this.process = options.process
        this.onStarted = options.onStarted
        this.onProgress = options.onProgress
        this.onCompleted = options.onCompleted
    }

    private async waitForReady(): Promise<void> {
        return new Promise(resolve => {
            const poll = () => {
                if (this.ready) {
                    return resolve()
                }

                setTimeout(poll, 500)
            }

            poll()
        })
    }

    private async *batchProcess(results: Result[]): AsyncGenerator<Result[]> {
        let batch: Result[] = []

        for (const result of results) {
            batch.push(result)

            if (batch.length === this.batchSize) {
                yield batch
                batch = []
            }
        }

        if (batch.length > 0) {
            yield batch
        }
    }

    async start(results: Result[]) {
        if (this.started || !this.ready) return

        this.started = true
        this.onStarted()

        await this.waitForReady()

        let index: number = 0

        for await (const batch of this.batchProcess(results)) {
            for (const result of batch) {
                const node = await framer.getNode(result.id)
                if (!isCanvasNode(node)) continue

                await this.process(result, node, index)
                index += 1
            }

            this.onProgress(index, results.length)
        }

        this.started = false
        this.onCompleted()
    }

    setReady(ready: boolean) {
        this.ready = ready
    }
}
