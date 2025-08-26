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

export type IndexNodeRootNode = ComponentNode | WebPageNode
export type IndexNodeRootNodeType = IndexNodeRootNode["__class"]

export type IndexEntryType = AnyNode["__class"]

interface IndexEntryBase {
    readonly id: string
    readonly type: string
    readonly rootNodeId: string
    readonly text: string | null
    readonly addedInIndexRun: number
}

export interface IndexNodeEntry extends IndexEntryBase {
    readonly type: IndexEntryType // basically: string
    readonly nodeId: string
    readonly rootNodeName: string | null
    readonly rootNodeType: IndexNodeRootNodeType // basically: string
    readonly text: string | null
    readonly name: string | null
}

export interface IndexCollectionItemEntry extends IndexEntryBase {
    readonly type: "CollectionItemField"
    readonly collectionItemId: string
    readonly rootNodeName: string
    readonly rootNodeType: "Collection"
    readonly matchingField: {
        readonly name: string | null
        readonly id: string
    }
    readonly text: string
}

export type IndexEntry = IndexNodeEntry | IndexCollectionItemEntry

export type RootNodeType = IndexEntry["rootNodeType"]

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
