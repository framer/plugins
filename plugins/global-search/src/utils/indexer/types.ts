import {
    type AnyNode,
    ComponentNode,
    isComponentInstanceNode,
    isComponentNode,
    isFrameNode,
    isSVGNode,
    isTextNode,
    isWebPageNode,
    WebPageNode,
} from "framer-plugin"

export type RootNode = ComponentNode | WebPageNode
export type RootNodeType = RootNode["__class"]

// Search index entry - extends the renamer's IndexEntry concept
export interface IndexEntry {
    id: string
    type: AnyNode["__class"]
    name: string | null
    text: string | null
    node: AnyNode
    rootNodeName: string | null
    rootNodeType: RootNodeType
    rootNode: AnyNode
}

export interface TextRange {
    start: number
    end: number
}

export const includedAttributes = ["text"] as const
export type IncludedAttribute = (typeof includedAttributes)[number]

export function shouldIndexNode(value: AnyNode): boolean {
    if (isFrameNode(value)) return true
    if (isComponentInstanceNode(value)) return true
    if (isTextNode(value)) return true
    if (isSVGNode(value)) return true
    if (isWebPageNode(value)) return true
    if (isComponentNode(value)) return true

    return false
}
