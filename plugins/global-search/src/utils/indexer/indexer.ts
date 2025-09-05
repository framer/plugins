import {
    type AnyNode,
    type CanvasRootNode,
    type Collection,
    framer,
    isComponentNode,
    isFrameNode,
    isTextNode,
    isWebPageNode,
} from "framer-plugin"
import { GlobalSearchDatabase } from "../db"
import { type EventMap, TypedEventEmitter } from "../event-emitter"
import { stripMarkup } from "./strip-markup"
import {
    type IndexableNode,
    type IndexCodeFileEntry,
    type IndexEntry,
    type IndexNodeRootNode,
    includedAttributes,
    isIndexableNode,
} from "./types"

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
    started: { indexRun: number }
    completed: never
    restarted: never
    aborted: never
    canvasRootChangeStarted: never
    canvasRootChangeCompleted: never
}

export class GlobalSearchIndexer {
    private eventEmitter = new TypedEventEmitter<IndexerEvents>()
    public on: typeof this.eventEmitter.on = (...args) => this.eventEmitter.on(...args)

    // For every update we make, an active query will be re-run.
    // Adjusting this value over time will affect the performance of the UI.
    // A smaller batch size will make showing results faster, but will also make the UI more laggy.
    private batchSize = 100
    private abortRequested = false
    private canvasSubscription: (() => void) | null = null
    private currentCanvasRootChangeAbortController: AbortController | null = null

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

                if (!isIndexableNode(node) || !node.visible) continue

                const text = await this.getNodeText(node)

                if (!text) continue

                // skipping the entry if it's a duplicate of the original node with the same text
                if (node.originalId) {
                    const originalNode = await framer.getNode(node.originalId)
                    if (originalNode && isIndexableNode(originalNode) && originalNode.visible) {
                        const originalText = await this.getNodeText(originalNode)
                        if (originalText === text) {
                            continue
                        }
                    }
                }

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

    private async handleCanvasRootChange(rootNode: CanvasRootNode) {
        if (this.abortRequested) return

        this.currentCanvasRootChangeAbortController?.abort()

        const abortController = new AbortController()
        this.currentCanvasRootChangeAbortController = abortController

        this.eventEmitter.emit("canvasRootChangeStarted")

        try {
            if (abortController.signal.aborted) return

            const lastIndexRun = await this.db.getLastIndexRun()
            const currentIndexRun = lastIndexRun + 1
            await this.processNodes(currentIndexRun, [rootNode], abortController.signal)
            await this.db.clearEntriesForRootNodeAndSpecificVersion(rootNode.id, lastIndexRun)
        } catch (error) {
            this.eventEmitter.emit("error", { error: error instanceof Error ? error : new Error(String(error)) })
        } finally {
            if (this.currentCanvasRootChangeAbortController === abortController) {
                this.currentCanvasRootChangeAbortController = null
            }
            this.eventEmitter.emit("canvasRootChangeCompleted")
        }
    }

    private async processNodes(
        currentIndexRun: number,
        rootNodes: readonly CanvasRootNode[],
        abortSignal?: AbortSignal
    ) {
        const validRootNodes = rootNodes.filter(rootNode => isComponentNode(rootNode) || isWebPageNode(rootNode))

        for await (const batch of this.crawlNodes(currentIndexRun, validRootNodes)) {
            if (this.abortRequested || abortSignal?.aborted) break
            await this.db.upsertEntries(batch)
        }
    }

    private async processCollections(currentIndexRun: number) {
        const collections = await framer.getCollections()

        for await (const batch of this.crawlCollections(currentIndexRun, collections)) {
            if (this.abortRequested) break
            await this.db.upsertEntries(batch)
        }
    }

    private async processCodeFiles(currentIndexRun: number) {
        const allFiles = await framer.getCodeFiles()

        const batch: IndexCodeFileEntry[] = []
        for (const file of allFiles) {
            if (this.abortRequested) break

            const text = file.content
            if (!text || text.length === 0) continue

            batch.push({
                id: file.id,
                type: "CodeFile",
                nodeId: file.id,
                text,
                rootNodeId: file.id,
                rootNodeName: file.name,
                rootNodeType: "CodeFile",
                addedInIndexRun: currentIndexRun,
            })

            if (batch.length >= this.batchSize) {
                await this.db.upsertEntries(batch)
                batch.length = 0
            }
        }

        if (batch.length > 0) {
            await this.db.upsertEntries(batch)
        }
    }

    async start() {
        // XXX: The indexer has no "locking mechanism" to prevent multiple instances from running at the same time in multiple tabs.
        try {
            const lastIndexRun = await this.db.getLastIndexRun()
            const currentIndexRun = lastIndexRun + 1

            const [pages, components, canvasRoot] = await Promise.all([
                framer.getNodesWithType("WebPageNode"),
                framer.getNodesWithType("ComponentNode"),
                framer.getCanvasRoot(),
            ])

            this.abortRequested = false
            this.eventEmitter.emit("started", { indexRun: currentIndexRun })

            this.canvasSubscription ??= framer.subscribeToCanvasRoot(rootNode => {
                void this.handleCanvasRootChange(rootNode)
            })

            // Remove the current open canvas root from the list of root nodes to index
            // as it's already being indexed by the canvas root watcher
            const rootNodesWithoutCurrentRoot = [...pages, ...components].filter(
                rootNode => rootNode.id !== canvasRoot.id
            )

            await Promise.all([
                this.processNodes(currentIndexRun, rootNodesWithoutCurrentRoot),
                this.processCollections(currentIndexRun),
                this.processCodeFiles(currentIndexRun),
            ])

            // this isn't a unnecassary static expression, as the value could change during the async loop
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!this.abortRequested) {
                await this.db.clearEntriesFromBefore(currentIndexRun)
                this.eventEmitter.emit("completed")
            }
        } catch (error) {
            this.eventEmitter.emit("error", { error: error instanceof Error ? error : new Error(String(error)) })
        }
    }

    async restart() {
        this.abort()

        this.eventEmitter.emit("restarted")
        return this.start()
    }

    abort() {
        this.abortRequested = true

        this.currentCanvasRootChangeAbortController?.abort()
        this.currentCanvasRootChangeAbortController = null

        if (this.canvasSubscription) {
            this.canvasSubscription()
            this.canvasSubscription = null
        }

        this.eventEmitter.emit("aborted")
    }
}
