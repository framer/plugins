import type {
    IndexCodeFileEntry,
    IndexCollectionItemEntry,
    IndexEntry,
    IndexNodeEntry,
    RootNodeType,
} from "../indexer/types"
import type { Range } from "./ranges"

export const enum FilterType {
    RootNodes = "rootNodes",
}

export const enum MatcherType {
    Text = "text",
}

// A matcher produces a result, while a filter can narrows down the results
export interface TextMatcher {
    readonly type: MatcherType.Text
    readonly query: string
    readonly caseSensitive: boolean
}

export interface RootNodesFilter {
    readonly type: FilterType.RootNodes
    readonly rootNodes: readonly RootNodeType[]
}

export type Matcher = TextMatcher
export type Filter = RootNodesFilter

export enum ResultType {
    CollectionItemField = "CollectionItemField",
    Node = "Node",
    CodeFile = "CodeFile",
}

export interface BaseResult {
    readonly type: ResultType
    readonly id: string
    readonly text: string
    readonly ranges: readonly Range[]
    readonly entry: IndexEntry
}

export interface CollectionItemResult extends BaseResult {
    readonly type: ResultType.CollectionItemField
    readonly matchingField: IndexCollectionItemEntry["matchingField"]
    readonly text: string
    readonly entry: IndexCollectionItemEntry
}

export interface NodeResult extends BaseResult {
    readonly type: ResultType.Node
    readonly entry: IndexNodeEntry
}

export interface CodeFileResult extends BaseResult {
    readonly type: ResultType.CodeFile
    readonly entry: IndexCodeFileEntry
}

export type Result = CollectionItemResult | NodeResult | CodeFileResult
