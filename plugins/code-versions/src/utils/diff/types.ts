/**
 * line-level difference
 */
export type LineDiff =
    | { type: "context"; content: string; oldLine: number; newLine: number }
    | { type: "add"; content: string; oldLine: null; newLine: number }
    | { type: "remove"; content: string; oldLine: number; newLine: null }
    | {
          type: "change"
          oldLine: number
          newLine: number
          oldContent: string
          newContent: string
          inlineDiffs: InlineDiff[]
      }
    | { type: "divider"; betweenLines: [number, number] }

/**
 * word-level difference within a single line.
 */
export interface InlineDiff {
    type: "unchanged" | "add" | "remove"
    value: string
}
