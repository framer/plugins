import {
    type AnyNode,
    ComponentInstanceNode,
    ComponentNode,
    isComponentInstanceNode,
    isTextNode,
    TextNode,
    WebPageNode,
} from "framer-plugin"

export type IndexNodeRootNode = ComponentNode | WebPageNode
export type IndexNodeRootNodeType = IndexNodeRootNode["__class"]

export type IndexableNode = Extract<AnyNode, TextNode | ComponentInstanceNode>
export type IndexEntryType = AnyNode["__class"]

export function isIndexableNode<T extends AnyNode>(value: T): value is T & IndexableNode {
    if (isComponentInstanceNode(value)) return true
    if (isTextNode(value)) return true

    return false
}

interface IndexEntryBase {
    readonly id: string
    readonly type: string
    readonly rootNodeId: string
    readonly text: string | null
    readonly addedInIndexRun: number
}

export interface IndexNodeEntry extends IndexEntryBase {
    readonly type: IndexEntryType
    readonly nodeId: string
    readonly rootNodeName: string | null
    readonly rootNodeType: IndexNodeRootNodeType
    readonly text: string | null
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

export interface IndexCodeFileEntry extends IndexEntryBase {
    readonly type: "CodeFile"
    readonly nodeId: string
    readonly rootNodeName: string
    readonly rootNodeType: "CodeFile"
    readonly text: string
}

export type IndexEntry = IndexNodeEntry | IndexCollectionItemEntry | IndexCodeFileEntry

export type RootNodeType = IndexEntry["rootNodeType"]

export const includedAttributes = ["text"] as const
export type IncludedAttribute = (typeof includedAttributes)[number]
