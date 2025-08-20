import {
    type AnyNode,
    Collection,
    framer,
    isComponentNode,
    isFrameNode,
    isTextNode,
    isWebPageNode,
} from "framer-plugin"
import { type EventMap, TypedEventEmitter } from "../event-emitter"
import { stripMarkup } from "./strip-markup"
import { type IndexEntry, type IndexNodeRootNode, includedAttributes, shouldIndexNode } from "./types"

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
    started: never
    completed: never
    restarted: never
    aborted: never
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

    private async *crawlNodes(rootNodes: readonly IndexNodeRootNode[]): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const rootNode of rootNodes) {
            const rootNodeName = await getNodeName(rootNode)

            for await (const node of rootNode.walk()) {
                if (this.abortRequested) return

                if (!shouldIndexNode(node)) continue

                const [text, name] = await Promise.all([this.getNodeText(node), getNodeName(node)])

                if (!text && !name) continue

                batch.push({
                    id: node.id,
                    type: node.__class,
                    nodeId: node.id,
                    name,
                    text,
                    rootNodeId: rootNode.id,
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

    private async *crawlCollections(collections: readonly Collection[]): AsyncGenerator<IndexEntry[]> {
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
                        id: `${item.id}-${key}`,
                        type: "CollectionItemField",
                        collectionItemId: item.id,
                        rootNodeId: collection.id,
                        rootNodeName: collection.name,
                        rootNodeType: "Collection",
                        matchingField: {
                            name: fieldNameMap.get(key) ?? null,
                            id: key,
                        },
                        text,
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
        try {
            const [pages, components] = await Promise.all([
                framer.getNodesWithType("WebPageNode"),
                framer.getNodesWithType("ComponentNode"),
            ])

            this.abortRequested = false
            this.eventEmitter.emit("started")

            for await (const batch of this.crawlNodes([...pages, ...components])) {
                // this isn't a unnecassary static expression, as the value could change during the async loop
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (this.abortRequested) break
                this.upsertEntries(batch)
            }

            const collections = await framer.getCollections()

            for await (const batch of this.crawlCollections(collections)) {
                // this isn't a unnecassary static expression, as the value could change during the async loop
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (this.abortRequested) break
                this.upsertEntries(batch)
            }

            // this isn't a unnecassary static expression, as the value could change during the async loop
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
