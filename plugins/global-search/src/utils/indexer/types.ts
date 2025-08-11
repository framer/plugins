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

export type RootNode = ComponentNode | WebPageNode
export type RootNodeType = RootNode["__class"]

export type IndexEntryType = AnyNode["__class"]

interface IndexEntryBase {
    id: string
    type: string
}

export interface IndexNodeEntry extends IndexEntryBase {
    type: IndexEntryType
    node: AnyNode
    rootNodeName: string | null
    rootNode: RootNode
    rootNodeType: RootNodeType
    text: string | null
    name: string | null
}

export interface IndexCollectionItemEntry extends IndexEntryBase {
    type: "CollectionItem"
    collectionItem: CollectionItem
    rootNodeName: string
    rootNode: Collection
    rootNodeType: "Collection"
    slug: string
    fields: Record<string, string>
}

export type IndexEntry = IndexNodeEntry | IndexCollectionItemEntry

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
