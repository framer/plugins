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

    private async *crawlNodes(rootNodes: readonly IndexNodeRootNode[]): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const rootNode of rootNodes) {
            const rootNodeName = await getNodeName(rootNode)

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

    private async *crawlCollections(collections: readonly Collection[]): AsyncGenerator<IndexEntry[]> {
        let batch: IndexEntry[] = []

        for (const collection of collections) {
            const [fieldNames, items] = await Promise.all([collection.getFields(), collection.getItems()])
            const fieldNameMap = new Map(fieldNames.map(f => [f.id, f.name]))

            for (const item of items) {
                const fields = Object.fromEntries(
                    Object.entries(item.fieldData).flatMap(([key, field]) => {
                        const finalKey = fieldNameMap.get(key) ?? key
                        switch (field.type) {
                            case "string":
                                return [[finalKey, field.value]]
                            case "formattedText":
                                return [[finalKey, stripMarkup(field.value)]]
                        }
                        return []
                    })
                )

                batch.push({
                    id: item.id,
                    type: "CollectionItem",
                    collectionItem: item,
                    rootNode: collection,
                    rootNodeName: collection.name,
                    rootNodeType: "Collection",
                    fields,
                    slug: item.slug,
                })
            }

            if (batch.length === this.batchSize) {
                yield batch
                batch = []
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
                if (this.abortRequested) break
                this.upsertEntries(batch)
            }

            const collections = await framer.getCollections()

            for await (const batch of this.crawlCollections(collections)) {
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
