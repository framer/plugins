import { type AnyNode, framer, isComponentNode, isFrameNode, isTextNode, isWebPageNode } from "framer-plugin"
import { TypedEventEmitter } from "./event-emitter"
import { stripMarkup } from "./strip-markup"
import { type IndexEntry, includedAttributes, type RootNode, shouldIndexNode } from "./types"

async function getNodeName(node: AnyNode): Promise<string | null> {
    if (isWebPageNode(node)) {
        if (node.path === "/") return "Home"
        if (!node.path) return "Web Page"
        return node.path
    }

    if (isComponentNode(node)) {
        return node.name ?? "Component"
    }

    if (isFrameNode(node)) {
        return node.name ?? "Frame"
    }

    if (isTextNode(node)) {
        return (await node.getText()) ?? null
    }

    return null
}

export interface IndexerEvents extends EventMap {
    upsert: { entry: IndexEntry }
    error: { error: Error }
    progress: { processed: number; total?: number }
    started: void
    completed: void
    restarted: void
    aborted: void
}

export class GlobalSearchIndexer {
    private eventEmitter = new TypedEventEmitter<IndexerEvents>()
    public on: typeof this.eventEmitter.on = (...args) => this.eventEmitter.on(...args)

    private entries: Record<string, IndexEntry> = {}
    private batchSize = 10

    private abortRequested = false

    private upsertEntries(entries: IndexEntry[]) {
        for (const entry of entries) {
            this.entries[entry.id] = entry
            this.eventEmitter.emit("upsert", { entry })
        }
    }

    private async getNodeText(node: AnyNode): Promise<string | null> {
        if (includedAttributes.includes("text") && isTextNode(node)) {
            return await node.getText()
        }
        return null
    }

    private async *crawl(rootNodes: readonly RootNode[]): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const rootNode of rootNodes) {
            const rootNodeName = await getNodeName(rootNode)
            if (shouldIndexNode(rootNode)) {
                const text = await this.getNodeText(rootNode)
                batch.push({
                    id: rootNode.id,
                    type: rootNode.__class,
                    name: rootNodeName,
                    text,
                    node: rootNode,
                    rootNode,
                    rootNodeName,
                    rootNodeType: rootNode.__class,
                })
            }

            for await (const node of rootNode.walk()) {
                if (this.abortRequested) return

                if (!shouldIndexNode(node)) continue

                const [text, name] = await Promise.all([this.getNodeText(node), getNodeName(node)])

                batch.push({
                    id: node.id,
                    type: node.__class,
                    name,
                    text,
                    node,
                    rootNode,
                    rootNodeName,
                    rootNodeType: rootNode.__class,
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

    async start() {
        try {
            const [pages, components] = await Promise.all([
                framer.getNodesWithType("WebPageNode"),
                framer.getNodesWithType("ComponentNode"),
            ])

            this.abortRequested = false
            this.eventEmitter.emit("started")

            for await (const batch of this.crawl([...pages, ...components])) {
                if (this.abortRequested) break
                this.upsertEntries(batch)
            }

            if (!this.abortRequested) {
                this.eventEmitter.emit("completed")
            }
        } catch (error) {
            this.eventEmitter.emit("error", { error: error instanceof Error ? error : new Error(String(error)) })
        }
    }

    async restart() {
        this.abortRequested = true
        this.entries = {}
        this.eventEmitter.emit("restarted")
        return this.start()
    }

    abort() {
        this.abortRequested = true
    }

    getEntries(): IndexEntry[] {
        return Object.values(this.entries)
    }
}
