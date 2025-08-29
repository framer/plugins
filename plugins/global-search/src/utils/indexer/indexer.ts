import {
    type AnyNode,
    Collection,
    framer,
    isComponentNode,
    isFrameNode,
    isTextNode,
    isWebPageNode,
} from "framer-plugin"
import { GlobalSearchDatabase } from "../db"
import { type EventMap, TypedEventEmitter } from "../event-emitter"
import { stripMarkup } from "./strip-markup"
import { type IndexEntry, type IndexNodeRootNode, type IndexableNode, includedAttributes, isIndexableNode } from "./types"

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
    error: { error: Error }
    progress: { processed: number; total?: number }
    started: { indexRun: number }
    completed: never
    restarted: never
    aborted: never
}

export class GlobalSearchIndexer {
    private eventEmitter = new TypedEventEmitter<IndexerEvents>()
    public on: typeof this.eventEmitter.on = (...args) => this.eventEmitter.on(...args)

    // For every update we make, an active query will be re-run.
    // Adjusting this value over time will affect the performance of the UI.
    // A smaller batch size will make showing results faster, but will also make the UI more laggy.
    private batchSize = 100
    private abortRequested = false

    constructor(private db: GlobalSearchDatabase) {}

    private async getNodeText(node: IndexableNode): Promise<string | null> {
        if (includedAttributes.includes("text") && isTextNode(node)) {
            const html = await node.getHTML()
            return html ? stripMarkup(html) : null
        }
        return null
    }

    private async *crawlNodes(indexRun: number, rootNodes: readonly IndexNodeRootNode[]): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const rootNode of rootNodes) {
            const rootNodeName = await getNodeName(rootNode)

            for await (const node of rootNode.walk()) {
                if (this.abortRequested) return

                if (!isIndexableNode(node)) continue

                const text = await this.getNodeText(node)

                if (!text) continue

                batch.push({
                    id: node.id,
                    type: node.__class,
                    nodeId: node.id,
                    text,
                    rootNodeId: rootNode.id,
                    rootNodeName,
                    rootNodeType: rootNode.__class,
                    addedInIndexRun: indexRun,
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

    private async *crawlCollections(
        indexRun: number,
        collections: readonly Collection[]
    ): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const collection of collections) {
            const [fieldNames, items] = await Promise.all([collection.getFields(), collection.getItems()])
            const fieldNameMap = new Map(fieldNames.map(f => [f.id, f.name]))

            for (const item of items) {
                for (const [key, field] of Object.entries(item.fieldData)) {
                    if (field.type !== "string" && field.type !== "formattedText") continue

                    const text = field.type === "formattedText" ? stripMarkup(field.value) : field.value

                    // Skip empty fields
                    if (text.length === 0) continue

                    batch.push({
                        id: `${item.nodeId}-${key}`,
                        type: "CollectionItemField",
                        collectionItemId: item.nodeId,
                        rootNodeId: collection.id,
                        rootNodeName: collection.name,
                        rootNodeType: "Collection",
                        matchingField: {
                            name: fieldNameMap.get(key) ?? null,
                            id: key,
                        },
                        text,
                        addedInIndexRun: indexRun,
                    })

                    if (batch.length === this.batchSize) {
                        yield batch
                        batch = []
                    }
                }
            }
        }

        if (batch.length > 0) {
            yield batch
        }
    }

    async start() {
        // XXX: The indexer has no "locking mechanism" to prevent multiple instances from running at the same time in multiple tabs.
        try {
            const lastIndexRun = await this.db.getLastIndexRun()
            const currentIndexRun = lastIndexRun + 1

            const [pages, components] = await Promise.all([
                framer.getNodesWithType("WebPageNode"),
                framer.getNodesWithType("ComponentNode"),
            ])

            this.abortRequested = false
            this.eventEmitter.emit("started", { indexRun: currentIndexRun })

            for await (const batch of this.crawlNodes(currentIndexRun, [...pages, ...components])) {
                // this isn't a unnecassary static expression, as the value could change during the async loop
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (this.abortRequested) break
                await this.db.upsertEntries(batch)
            }

            const collections = await framer.getCollections()

            for await (const batch of this.crawlCollections(currentIndexRun, collections)) {
                // this isn't a unnecassary static expression, as the value could change during the async loop
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (this.abortRequested) break
                await this.db.upsertEntries(batch)
            }

            // this isn't a unnecassary static expression, as the value could change during the async loop
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!this.abortRequested) {
                await this.db.clearEntriesFromBefore(lastIndexRun)
                this.eventEmitter.emit("completed")
            }
        } catch (error) {
            this.eventEmitter.emit("error", { error: error instanceof Error ? error : new Error(String(error)) })
        }
    }

    async restart() {
        this.abortRequested = true
        this.eventEmitter.emit("restarted")
        return this.start()
    }

    abort() {
        this.abortRequested = true
    }

    /**
     * @deprecated Use the `AsyncProcessor` instead. Used in devtools
     */
    async getEntries(): Promise<IndexEntry[]> {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        return await this.db.getAllEntries()
    }
}
