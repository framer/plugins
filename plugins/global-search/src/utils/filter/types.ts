import type { IndexCollectionItemEntry, IndexEntry, IndexNodeEntry, RootNodeType } from "../indexer/types"
import type { Range } from "./ranges"

export const enum FilterType {
    Text = "text",
    RootNodes = "rootNodes",
}

interface BaseFilter {
    readonly type: FilterType
}

export interface TextFilter extends BaseFilter {
    readonly type: FilterType.Text
    readonly query: string
    readonly caseSensitive: boolean
}

export interface RootNodesFilter extends BaseFilter {
    readonly type: FilterType.RootNodes
    readonly rootNodes: readonly RootNodeType[]
}

export type Filter = TextFilter | RootNodesFilter

export enum ResultType {
    CollectionItem = "CollectionItem",
    Node = "Node",
}

export interface BaseResult {
    readonly type: ResultType
    readonly id: string
    readonly text: string
    readonly ranges: readonly Range[]
    readonly entry: IndexEntry
}

export interface CollectionItemResult extends BaseResult {
    readonly type: ResultType.CollectionItem
    readonly field: keyof IndexCollectionItemEntry["fields"]
    readonly text: string
    readonly entry: IndexCollectionItemEntry
}

export interface NodeResult extends BaseResult {
    readonly type: ResultType.Node
    readonly entry: IndexNodeEntry
}

export type Result = CollectionItemResult | NodeResult
