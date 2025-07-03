import { diffWords } from "diff"
import type { InlineDiff } from "./types"

/**
 * Converts a diff part from the 'diff' library into our InlineDiff format.
 */
export function getInlineDiff(oldLine: string, newLine: string): InlineDiff[] {
    return diffWords(oldLine, newLine).map(part =>
        part.added
            ? { type: "add", value: part.value }
            : part.removed
              ? { type: "remove", value: part.value }
              : { type: "unchanged", value: part.value }
    )
}
