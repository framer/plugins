import { framer, isFrameNode, isTextNode, isWebPageNode, WebPageNode } from "framer-plugin"
import { isCanvasNode } from "./traits"
import type { CanvasNode, IndexEntry } from "./types"

async function getDefaultCanvasNodeName(node: CanvasNode): Promise<string> {
    if (isFrameNode(node)) {
        return "Frame"
    }

    if (isTextNode(node)) {
        return (await node.getText()) ?? ""
    }

    return ""
}

type IncludedAttributes = ("text" | "rect")[]

interface IndexerOptions {
    scope: "project" | "page"
    includedNodeTypes: IndexEntry["type"][]
    includedAttributes?: IncludedAttributes
    onRestarted: () => void
    onStarted: () => void
    onUpsert: (entry: IndexEntry) => void
    onCompleted: () => void
}

export class Indexer {
    private entries: Record<string, IndexEntry> = {}
    private batchSize = 10
    private scope: IndexerOptions["scope"] = "page"
    private includedNodeTypes: IndexerOptions["includedNodeTypes"]
    private includedAttributes: IncludedAttributes = ["text", "rect"]
    private abortRequested = false
    private onRestarted: IndexerOptions["onRestarted"]
    private onStarted: IndexerOptions["onStarted"]
    private onUpsert: IndexerOptions["onUpsert"]
    private onCompleted: IndexerOptions["onCompleted"]

    constructor(options: IndexerOptions) {
        this.scope = options.scope
        this.includedNodeTypes = options.includedNodeTypes
        this.includedAttributes = options.includedAttributes ?? this.includedAttributes
        this.onRestarted = options.onRestarted
        this.onStarted = options.onStarted
        this.onUpsert = options.onUpsert
        this.onCompleted = options.onCompleted
    }

    private isIncludedNodeType(node: CanvasNode): boolean {
        return this.includedNodeTypes.length !== 0 && this.includedNodeTypes.includes(node.__class)
    }

    private upsertEntries(entries: IndexEntry[]) {
        for (const entry of entries) {
            this.entries[entry.id] = entry
            this.onUpsert(entry)
        }
    }

    private async *crawl(pages: WebPageNode[]): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const page of pages) {
            for await (const node of page.walk()) {
                if (this.abortRequested) return

                if (!isCanvasNode(node)) continue
                if (!this.isIncludedNodeType(node)) continue

                const name = node.name ?? (await getDefaultCanvasNodeName(node))

                const rect = this.includedAttributes.includes("rect") ? await node.getRect() : null

                const text = this.includedAttributes.includes("text") && isTextNode(node) ? await node.getText() : null

                batch.push({
                    id: node.id,
                    type: node.__class,
                    locked: node.locked,
                    visible: node.visible,
                    name,
                    rect,
                    text,
                })

                if (batch.length === this.batchSize) {
                    yield batch
                    batch = []
                }
            }
        }

        if (batch.length > 0) {
            yield batch
        }
    }

    private async getPages(): Promise<WebPageNode[]> {
        const root = await framer.getCanvasRoot()
        if (!isWebPageNode(root)) return []

        if (this.scope === "page") {
            return [root]
        }

        return await framer.getNodesWithType("WebPageNode")
    }

    async start() {
        const pages = await this.getPages()

        this.abortRequested = false
        this.onStarted()

        for await (const batch of this.crawl(pages)) {
            this.upsertEntries(batch)
        }

        this.onCompleted()
    }

    async restart() {
        this.abortRequested = true
        this.entries = {}
        this.onRestarted()
        return this.start()
    }
}
