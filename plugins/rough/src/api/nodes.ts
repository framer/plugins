import type { PluginApi } from "./api"
import type { BorderRadius, WithBackgroundColor, WithBorderRadius, WithName, WithOpacity, WithRotation } from "./traits"

import { assert, assertNever, isString } from "./utils"

export type NodeId = string

interface PrivateNodeData {
    __class: "FrameNode" | "TextNode" | "SVGNode" | "CodeComponentNode" | "WebPageNode" | "SmartComponentNode"
    children: AnyNodeData[] | null
}

export interface MandatoryData extends PrivateNodeData {
    id: NodeId
}

type HidePrivateNodeData<T extends PrivateNodeData> = Omit<T, keyof PrivateNodeData>
type HideImmutableData<T extends MandatoryData> = Omit<T, keyof MandatoryData>

export abstract class NodeMethods {
    readonly id: string

    // We use `#` to make sure the api and data fields can not be observed when a user logs or loops
    // over a node instance.
    #api: PluginApi
    #data: Partial<AnyNodeData>

    constructor(data: Partial<AnyNodeData>, api: PluginApi) {
        assert(isString(data.id), "Node must have an id")
        this.id = data.id
        this.#api = api
        this.#data = data
    }

    remove(): Promise<void> {
        return this.#api.removeNode(this.id)
    }

    select(): Promise<void> {
        return this.#api.setSelection([this.id])
    }

    clone(): Promise<AnyNode | null> {
        return this.#api.cloneNode(this.id)
    }

    setAttributes(update: Partial<AnyNodeData>): Promise<AnyNode | null> {
        return this.#api.setAttributes(this.id, update)
    }

    // Iterators

    private getChildren(): CanvasNode[] {
        if (!this.#data.children) return []

        // TODO: cache the result of children
        const result: CanvasNode[] = []

        for (const child of this.#data.children) {
            try {
                result.push(convertRawCanvasNodeDataToNode(child, this.#api))
            } catch {
                // Ignore nodes that can't be converted
            }
        }

        return result
    }

    get children() {
        return this.getChildren()
    }

    *walk(this: CanvasNode): Generator<CanvasNode> {
        yield this

        for (const child of this.children) {
            yield* child.walk()
        }
    }
}

export interface FrameNodeData
    extends MandatoryData,
        WithName,
        WithBackgroundColor,
        WithRotation,
        WithOpacity,
        WithBorderRadius {}

export class FrameNode extends NodeMethods implements HidePrivateNodeData<FrameNodeData> {
    readonly name: string | null
    readonly backgroundColor: string | null
    readonly rotation: number | null
    readonly opacity: number | null
    readonly borderRadius: BorderRadius

    // TODO: hide the constructor from the public API, only the plugin should be able to create nodes
    constructor(rawData: Partial<FrameNodeData>, api: PluginApi) {
        super(rawData, api)

        this.name = rawData.name ?? null
        this.backgroundColor = rawData.backgroundColor ?? null
        this.rotation = rawData.rotation ?? null
        this.opacity = rawData.opacity ?? null
        this.borderRadius = rawData.borderRadius ?? null
    }

    override clone() {
        return super.clone() as Promise<FrameNode | null>
    }

    override setAttributes(update: Partial<HideImmutableData<FrameNodeData>>) {
        return super.setAttributes(update) as Promise<FrameNode | null>
    }
}

export interface TextNodeData extends MandatoryData, WithName {
    readonly html: string
}
export class TextNode extends NodeMethods implements HidePrivateNodeData<TextNodeData> {
    readonly name: string | null
    readonly html: string

    constructor(rawData: Partial<TextNodeData>, api: PluginApi) {
        super(rawData, api)

        assert(rawData.html)

        this.name = rawData.name ?? null
        this.html = rawData.html
    }

    override clone() {
        return super.clone() as Promise<TextNode | null>
    }

    override setAttributes(update: Partial<HideImmutableData<TextNodeData>>) {
        return super.setAttributes(update) as Promise<TextNode | null>
    }
}

export interface SVGNodeData extends MandatoryData, WithName {
    readonly svg: string
}
export class SVGNode extends NodeMethods implements HidePrivateNodeData<SVGNodeData> {
    readonly name: string | null
    readonly svg: string

    constructor(rawData: Partial<SVGNodeData>, api: PluginApi) {
        super(rawData, api)

        assert(rawData.svg)

        this.name = rawData.name ?? null
        this.svg = rawData.svg
    }

    override clone() {
        return super.clone() as Promise<SVGNode | null>
    }

    override setAttributes(update: Partial<HideImmutableData<SVGNodeData>>) {
        return super.setAttributes(update) as Promise<SVGNode | null>
    }
}

export interface CodeComponentNodeData extends MandatoryData, WithName {
    identifier: string
    componentProps: Record<string, unknown>
}
export class CodeComponentNode extends NodeMethods implements HidePrivateNodeData<CodeComponentNodeData> {
    readonly name: string | null
    readonly identifier: string
    readonly componentProps: Record<string, unknown>

    constructor(rawData: Partial<CodeComponentNodeData>, api: PluginApi) {
        super(rawData, api)

        assert(rawData.identifier)

        this.name = rawData.name ?? null
        this.identifier = rawData.identifier
        this.componentProps = rawData.componentProps ?? {}
    }

    override clone() {
        return super.clone() as Promise<CodeComponentNode | null>
    }

    override setAttributes(update: Partial<HideImmutableData<CodeComponentNodeData>>) {
        return super.setAttributes(update) as Promise<CodeComponentNode | null>
    }
}

export interface WebPageNodeData extends MandatoryData {}
export class WebPageNode extends NodeMethods implements HidePrivateNodeData<WebPageNodeData> {
    constructor(rawData: Partial<WebPageNodeData>, api: PluginApi) {
        super(rawData, api)
    }

    override clone() {
        return super.clone() as Promise<WebPageNode | null>
    }

    override setAttributes(update: Partial<HideImmutableData<WebPageNodeData>>) {
        return super.setAttributes(update) as Promise<WebPageNode | null>
    }
}

export interface SmartComponentNodeData extends MandatoryData, WithName {}
export class SmartComponentNode extends NodeMethods implements HidePrivateNodeData<SmartComponentNodeData> {
    readonly name: string | null

    constructor(rawData: Partial<SmartComponentNodeData>, api: PluginApi) {
        super(rawData, api)

        this.name = rawData.name ?? null
    }

    override clone() {
        return super.clone() as Promise<SmartComponentNode | null>
    }

    override setAttributes(update: Partial<HideImmutableData<SmartComponentNodeData>>) {
        return super.setAttributes(update) as Promise<SmartComponentNode | null>
    }
}

export type CanvasRootData = MandatoryData & (WebPageNodeData | SmartComponentNodeData)
export type CanvasRoot = WebPageNode | SmartComponentNode

export type CanvasNodeData = MandatoryData &
    Partial<FrameNodeData | TextNodeData | CodeComponentNodeData | SmartComponentNodeData | SVGNodeData>
export type AnyCanvasNodeData = Partial<
    FrameNodeData & TextNodeData & CodeComponentNodeData & SVGNodeData & SmartComponentNodeData
>
export type CanvasNode = FrameNode | TextNode | CodeComponentNode | SVGNode | SmartComponentNode

export type AnyNodeData = CanvasNodeData & CanvasRootData
export type AnyNode = CanvasNode | CanvasRoot

export function convertRawNodeDataToNode(rawNodeData: AnyNodeData, api: PluginApi): AnyNode {
    switch (rawNodeData.__class) {
        case "WebPageNode": {
            return new WebPageNode(rawNodeData, api)
        }
        case "CodeComponentNode":
        case "FrameNode":
        case "SVGNode":
        case "SmartComponentNode":
        case "TextNode": {
            return convertRawCanvasNodeDataToNode(rawNodeData, api)
        }
        default: {
            assertNever(rawNodeData.__class)
        }
    }
}

export function convertRawCanvasNodeDataToNode(rawCanvasNode: CanvasNodeData, api: PluginApi): CanvasNode {
    switch (rawCanvasNode.__class) {
        case "CodeComponentNode": {
            return new CodeComponentNode(rawCanvasNode, api)
        }
        case "FrameNode": {
            return new FrameNode(rawCanvasNode, api)
        }
        case "SVGNode": {
            return new SVGNode(rawCanvasNode, api)
        }
        case "SmartComponentNode": {
            return new SmartComponentNode(rawCanvasNode, api)
        }
        case "TextNode": {
            return new TextNode(rawCanvasNode, api)
        }
        case "WebPageNode": {
            // TODO: fix - CanvasNodeClass / RootNodeClass??
            throw new Error("WebPageNode is not a CanvasNode")
        }
        default: {
            assertNever(rawCanvasNode.__class)
        }
    }
}
