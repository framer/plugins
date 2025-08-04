import { framer } from "framer-plugin"
import { isCanvasNode } from "./traits"
import type { CanvasNode, Result } from "./types"

interface BatchProcessResultsOptions {
    process: (result: Result, node: CanvasNode, index: number) => Promise<boolean>
    onStarted: () => void
    onProgress?: (count: number, total: number) => void
    onCompleted: (renamedCount: number) => void
}

export class BatchProcessResults {
    private ready = false
    private started = false
    private batchSize = 10
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
                    resolve()
                    return
                }

                setTimeout(poll, 100)
            }

            poll()
        })
    }

    private *batchProcess(results: Result[]): Generator<Result[]> {
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
        if (this.started) {
            framer.notify("A layer rename operation is already in progress", { variant: "error" })
            return
        }

        this.started = true
        this.onStarted()

        await this.waitForReady()

        let index = 0
        let renamedCount = 0

        for (const batch of this.batchProcess(results)) {
            for (const result of batch) {
                const node = await framer.getNode(result.id)
                if (!isCanvasNode(node)) continue

                const changed = await this.process(result, node, index)
                if (changed) renamedCount += 1
                index += 1
            }

            this.onProgress?.(index, results.length)
        }

        this.started = false
        this.onCompleted(renamedCount)
    }

    setReady(ready: boolean) {
        this.ready = ready
    }
}
