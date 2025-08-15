import {
    type AnyNode,
    Collection,
    CollectionItem,
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
    readonly rootNode: IndexNodeRootNode | Collection
    readonly text: string | null
}

export interface IndexNodeEntry extends IndexEntryBase {
    readonly type: IndexEntryType
    readonly node: AnyNode
    readonly rootNodeName: string | null
    readonly rootNode: IndexNodeRootNode
    readonly rootNodeType: IndexNodeRootNodeType
    readonly text: string | null
    readonly name: string | null
}

export interface IndexCollectionItemEntry extends IndexEntryBase {
    readonly type: "CollectionItem"
    readonly collectionItem: CollectionItem
    readonly rootNodeName: string
    readonly rootNode: Collection
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
