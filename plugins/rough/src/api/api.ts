import { FramerImage, ImageData, ImageInput, SVGData, createImageDataFromInput } from "./image"
import {
    AnyNode,
    AnyNodeData,
    CanvasNode,
    CanvasNodeData,
    CanvasRoot,
    CanvasRootData,
    CodeComponentNode,
    CodeComponentNodeData,
    FrameNode,
    FrameNodeData,
    NodeId,
    SVGNode,
    SVGNodeData,
    TextNode,
    TextNodeData,
    convertRawCanvasNodeDataToNode,
    convertRawNodeDataToNode,
} from "./nodes"
import { PublishInfo } from "./publishInfo"
import {
    RPCEvent,
    RPCMessageId,
    RPCMethodInvocation,
    RPCSubscription,
    RPCSubscriptionEvent,
    RPCSubscriptionTopic,
    isRPCMessage,
} from "./rpc"
import { assert, assertNever, isString } from "./utils"

export type Unsubscribe = VoidFunction

// TODO: HostEvent? Is such a subscription also a function implementation?
// It would be nice to distinguish because they are handled differently.
type PostMessage = (message: RPCMethodInvocation | RPCSubscription, transfer?: Transferable[] | undefined) => void

export class PluginApi implements API {
    private count = 0
    private initialMessageQueue: [RPCMethodInvocation | RPCSubscription, Transferable[] | undefined][] = []
    private postMessage: PostMessage | undefined = undefined
    private methodResponseHandlers = new Map<RPCMessageId, (value: unknown) => void>()

    private subscriptions: Map<RPCSubscriptionTopic, Set<(value: unknown) => void>> = new Map()

    constructor() {
        window.addEventListener("message", this.onMessage)

        const initMessage: RPCEvent = {
            payload: { type: "init" },
            type: "event",
        }
        window.parent.postMessage(initMessage, "*")
    }

    private invoke<
        TName extends keyof PostMessageAPI,
        TArgs extends Parameters<PostMessageAPI[TName]>,
        TReturnType extends ReturnType<PostMessageAPI[TName]>,
    >(methodName: TName, ...args: TArgs): Promise<TReturnType> {
        return this.invokeTransferable(methodName, undefined, ...args)
    }

    private invokeTransferable<
        TName extends keyof PostMessageAPI,
        TArgs extends Parameters<PostMessageAPI[TName]>,
        TReturnType extends ReturnType<PostMessageAPI[TName]>,
    >(methodName: TName, transfer: Transferable[] | undefined, ...args: TArgs): Promise<TReturnType> {
        return new Promise(resolve => {
            const message: RPCMethodInvocation = {
                args,
                methodName,
                id: this.count++,
                type: "methodInvocation",
            }

            this.methodResponseHandlers.set(message.id, resolve as (value: unknown) => void)

            this.queueMessage(message, transfer)
        })
    }

    private subscribe<
        TTopic extends RPCSubscriptionTopic,
        TEvent extends Extract<RPCSubscriptionEvent, { topic: TTopic }>,
    >(topic: TTopic, callback: (data: TEvent["payload"]) => void): VoidFunction {
        // TODO: do we need ID at all?
        const subscriptionId = this.count++

        this.queueMessage({
            type: "subscribe",
            topic,
            id: subscriptionId,
        })

        const nextSubscriptions = this.subscriptions.get(topic) ?? new Set()
        nextSubscriptions.add(callback as (value: unknown) => void)

        this.subscriptions.set(topic, nextSubscriptions)

        return () => {
            const subscriptions = this.subscriptions.get(topic) ?? new Set()
            subscriptions.delete(callback as (value: unknown) => void)

            if (subscriptions.size === 0) {
                this.queueMessage({
                    type: "unsubscribe",
                    id: subscriptionId,
                    topic,
                })
            }

            this.subscriptions.set(topic, subscriptions)
        }
    }

    private queueMessage(message: RPCMethodInvocation | RPCSubscription, transfer?: Transferable[] | undefined) {
        if (!this.postMessage) {
            this.initialMessageQueue.push([message, transfer])
            return
        }

        this.postMessage(message, transfer)
    }

    private onMessage = (event: MessageEvent) => {
        const message = event.data
        if (!isRPCMessage(message)) {
            return
        }

        switch (message.type) {
            case "event": {
                this.handleEvent(message, event)
                break
            }
            case "methodInvocation": {
                throw new Error("Method invocation cannot be handled by plugin.")
            }
            case "methodResponse": {
                const resolveResponse = this.methodResponseHandlers.get(message.id)
                if (!resolveResponse) {
                    throw new Error(`No handler for response with id ${message.id}`)
                }

                this.methodResponseHandlers.delete(message.id)

                resolveResponse(message.result)
                break
            }
            case "subscriptionMessage": {
                const { topic, payload } = message

                const handlers = this.subscriptions.get(topic)
                if (!handlers) {
                    // Could be a race condition to return null?
                    throw new Error("Received a subscription message but no handler present")
                }

                for (const handler of handlers) {
                    handler(payload)
                }

                break
            }
            case "unsubscribe":
            case "subscribe": {
                // TODO: HostEvent / ConsumerEvent?
                throw new Error("Plugin received invalid event: " + event.type)
            }
            default: {
                assertNever(message)
            }
        }
    }

    private handleEvent = (event: RPCEvent, originalEvent: MessageEvent) => {
        switch (event.payload.type) {
            case "init": {
                const source = originalEvent.source
                if (!source) {
                    throw new Error("No 'source' on incoming 'init' message event")
                }

                // Transferable only exists on window.parent.postMessage and not source.postMessage
                this.postMessage = (
                    message: RPCMethodInvocation | RPCSubscription,
                    transfer?: Transferable[] | undefined
                ) => window.parent.postMessage(message, originalEvent.origin, transfer)

                for (const [message, transfer] of this.initialMessageQueue) {
                    this.postMessage(message, transfer)
                }
                this.initialMessageQueue = []
                break
            }
            default: {
                assertNever(event.payload.type)
            }
        }
    }

    async getSelection() {
        const nodesData = await this.invoke("getSelection")
        return nodesData.map(nodeData => convertRawCanvasNodeDataToNode(nodeData, this))
    }

    async setSelection(nodeIds: string | Iterable<string>) {
        const rpcNodeIds = isString(nodeIds) ? [nodeIds] : Array.from(nodeIds)

        return this.invoke("setSelection", rpcNodeIds)
    }

    subscribeToSelection(callback: (result: CanvasNode[]) => void): VoidFunction {
        return this.subscribe("selection", nodesData => {
            const nodes = nodesData.map(nodeData => convertRawCanvasNodeDataToNode(nodeData, this))
            callback(nodes)
        })
    }

    async getCanvasRoot() {
        const root = await this.invoke("getCanvasRoot")

        return convertRawNodeDataToNode(root, this)
    }

    subscribeToCanvasRoot(callback: (data: CanvasRoot) => void): VoidFunction {
        return this.subscribe("canvasRoot", data => {
            const instance = convertRawNodeDataToNode(data, this)

            callback(instance)
        })
    }

    async getPublishInfo() {
        return this.invoke("getPublishInfo")
    }

    subscribeToPublishInfo(callback: (data: PublishInfo) => void): VoidFunction {
        return this.subscribe("publishInfo", callback)
    }

    async createFrameNode(attributes: Partial<FrameNodeData>, parentId?: string): Promise<FrameNode | null> {
        const rawData = await this.invoke("createNode", "Frame", parentId ?? null, attributes)
        if (!rawData) return null

        const node = convertRawCanvasNodeDataToNode(rawData, this)

        assert(node instanceof FrameNode)

        return node
    }

    async createTextNode(attributes: Partial<TextNodeData>, parentId?: string): Promise<TextNode | null> {
        const rawData = await this.invoke("createNode", "Text", parentId ?? null, attributes)
        if (!rawData) return null

        const node = convertRawCanvasNodeDataToNode(rawData, this)
        assert(node instanceof TextNode)

        return node
    }

    async createSVGNode(attributes: Partial<SVGNodeData>, parentId?: string | undefined): Promise<SVGNode | null> {
        const rawData = await this.invoke("createNode", "SVG", parentId ?? null, attributes)
        if (!rawData) return null

        const node = convertRawCanvasNodeDataToNode(rawData, this)
        assert(node instanceof SVGNode)

        return node
    }

    async createCodeComponentNode(
        attributes: Partial<CodeComponentNodeData>,
        parentId?: string | undefined
    ): Promise<CodeComponentNode | null> {
        const rawData = await this.invoke("createNode", "CodeComponent", parentId ?? null, attributes)
        if (!rawData) return null

        const node = convertRawCanvasNodeDataToNode(rawData, this)
        assert(node instanceof CodeComponentNode)

        return node
    }

    async removeNode(nodeId: string): Promise<void> {
        return this.invoke("removeNode", nodeId)
    }

    async cloneNode(nodeId: string): Promise<AnyNode | null> {
        const rawData = await this.invoke("cloneNode", nodeId)
        if (!rawData) return null
        return convertRawNodeDataToNode(rawData, this)
    }

    async getNode(nodeId: string): Promise<AnyNode | null> {
        const rawData = await this.invoke("getNode", nodeId)
        if (!rawData) return null
        return convertRawNodeDataToNode(rawData, this)
    }

    async setAttributes(nodeId: string, attributes: Partial<AnyNodeData>): Promise<AnyNode | null> {
        const rawData = await this.invoke("setAttributes", nodeId, attributes)
        if (!rawData) return null
        return convertRawNodeDataToNode(rawData, this)
    }

    async setParent(nodeId: string, parentId: string, index?: number | undefined) {
        return this.invoke("setParent", nodeId, parentId, index)
    }

    async addImage(image: ImageInput): Promise<void> {
        const data = await createImageDataFromInput(image)
        return this.invokeTransferable("addImage", [data.bytes], data)
    }

    async uploadImage(image: ImageInput): Promise<FramerImage> {
        const data = await createImageDataFromInput(image)
        return this.invokeTransferable("uploadImage", [data.bytes], data)
    }

    async getImage(): Promise<FramerImage | null> {
        return this.invoke("getImage")
    }

    async addSVG(svg: SVGData): Promise<void> {
        return this.invoke("addSVG", svg)
    }

    async showWindow(): Promise<void> {
        return this.invoke("showWindow")
    }
}

export interface API {
    /** Get the current selection. */
    getSelection: () => Promise<CanvasNode[]>
    /** Set the current selection. */
    setSelection: (nodeIds: NodeId | Iterable<NodeId>) => Promise<void>
    /** Subscribe to selection changes. */
    subscribeToSelection: (selectionUpdate: (nodes: CanvasNode[]) => void) => Unsubscribe

    /** Get the root of the current canvas. */
    getCanvasRoot: () => Promise<CanvasRoot>
    /** Subscribe to canvas root changes */
    subscribeToCanvasRoot: (rootUpdate: (root: CanvasRoot) => void) => Unsubscribe

    /** Get the current publish info. */
    getPublishInfo: () => Promise<PublishInfo>
    /** Subscribe to publish info changes. */
    subscribeToPublishInfo: (publishInfoUpdate: (info: PublishInfo) => void) => Unsubscribe

    /** Create a new node on the canvas. */
    createFrameNode(attributes: Partial<FrameNodeData>, parentId?: NodeId): Promise<FrameNode | null>
    createTextNode(attributes: Partial<TextNodeData>, parentId?: NodeId): Promise<TextNode | null>
    createSVGNode(attributes: Partial<SVGNodeData>, parentId?: NodeId): Promise<SVGNode | null>
    createCodeComponentNode(
        attributes: Partial<CodeComponentNodeData>,
        parentId?: NodeId
    ): Promise<CodeComponentNode | null>

    /** Remove a node from the canvas. */
    removeNode: (nodeId: NodeId) => Promise<void>
    /** Clone a node. */
    cloneNode: (nodeId: NodeId) => Promise<AnyNode | null>
    /** Get a node by its id. */
    getNode: (nodeId: NodeId) => Promise<AnyNode | null>

    /** Set the attributes of a node. */
    setAttributes: (nodeId: NodeId, attributes: Partial<AnyNodeData>) => Promise<AnyNode | null>
    /** Set the parent of a node. */
    setParent: (nodeId: NodeId, parentId: NodeId, index?: number) => Promise<void>

    /** Upload an image, and either assign it to the selection, or insert on the canvas. */
    addImage: (image: ImageInput) => Promise<void>
    /** Upload an image without assigning it. */
    uploadImage: (image: ImageInput) => Promise<FramerImage>
    /** Get the optional image of the current selection. */
    getImage: () => Promise<FramerImage | null>

    /** Add an SVG, replacing the selected SVG, or insert on the canvas. */
    addSVG: (svg: SVGData) => Promise<void>

    /** Show the plugin window in Framer */
    showWindow: () => Promise<void>
}

export type CreateNodeType = "Frame" | "Text" | "SVG" | "CodeComponent"

export interface PostMessageAPI extends Pick<API, "getImage" | "addSVG"> {
    getSelection: () => Promise<CanvasNodeData[]>
    setSelection: (nodeIds: NodeId[]) => Promise<void>

    getCanvasRoot: () => Promise<CanvasRootData>

    getPublishInfo: () => Promise<PublishInfo>

    createNode: (
        type: CreateNodeType,
        parentId: NodeId | null,
        attributes: Partial<CanvasNodeData>
    ) => Promise<CanvasNodeData | null>
    removeNode: (nodeId: NodeId) => Promise<void>
    cloneNode: (nodeId: NodeId) => Promise<AnyNodeData | null>
    getNode: (nodeId: NodeId) => Promise<AnyNodeData | null>

    setAttributes: (nodeId: NodeId, attributes: Partial<AnyNodeData>) => Promise<AnyNodeData | null>

    addImage: (image: ImageData) => Promise<void>

    uploadImage: (image: ImageData) => Promise<FramerImage>

    setParent: (nodeId: NodeId, parentId: NodeId, index?: number) => Promise<void>

    showWindow: () => Promise<void>
}
