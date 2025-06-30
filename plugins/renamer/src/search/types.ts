import type { ComponentInstanceNode, FrameNode, SVGNode, TextNode } from "framer-plugin"
import type { Range } from "../utils/text"

export type IndexNodeType = Exclude<CanvasNode["__class"], "UnknownNode">

export interface IndexEntry {
    id: string
    type: IndexNodeType
    name: string
    text: string | null
    rect: { x: number; y: number; width: number; height: number } | null
    visible: boolean
    locked: boolean
}

export interface Result {
    id: string
    title: string
    ranges: Range[]
    entry: IndexEntry
}

export type CanvasNode = FrameNode | TextNode | ComponentInstanceNode | SVGNode
