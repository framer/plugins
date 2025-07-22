export interface Divider {
    type: "divider"
    line: number
}

/**
 * line-level difference
 */
export type LineDiff =
    | { type: "context"; content: string; oldLine: number; newLine: number }
    | { type: "add"; content: string; oldLine: null; newLine: number; isTopEdge?: boolean; isBottomEdge?: boolean }
    | { type: "remove"; content: string; oldLine: number; newLine: null; isTopEdge?: boolean; isBottomEdge?: boolean }
    | {
          type: "change"
          oldLine: number
          newLine: number
          oldContent: string
          newContent: string
          inlineDiffs: InlineDiff[]
          removeIsTopEdge?: boolean
          removeIsBottomEdge?: boolean
          addIsTopEdge?: boolean
          addIsBottomEdge?: boolean
      }
    | Divider

/**
 * word-level difference within a single line.
 */
export interface InlineDiff {
    type: "unchanged" | "add" | "remove"
    value: string
}
