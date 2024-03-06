import { PluginApi } from "./api"

export type { API, Unsubscribe } from "./api"
export type { PluginImage } from "./image"
export type { AnyNode, CanvasNode, CanvasRoot, NodeId } from "./nodes"

export { CodeComponentNode, FrameNode, SVGNode, SmartComponentNode, TextNode, WebPageNode } from "./nodes"
export * from "./traits"

export const api = new PluginApi()
