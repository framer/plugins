import { type ChangeObject } from "diff"
import { createAddLine, createChangeLine, createContextLine, createRemoveLine } from "./line-creators"
import type { LineDiff } from "./types"

interface DiffBlockResult {
    diffs: LineDiff[]
    oldLine: number
    newLine: number
}

interface UnprocessedDiffBlockResult extends DiffBlockResult {
    /**
     * When true, indicates that the next diff block was already processed
     * as part of a paired remove/add operation, so it should be skipped
     * to avoid double-processing the same content.
     */
    skipNext: boolean
}

function splitLinesAndRemoveTrailingEmpty(value: string): string[] {
    const lines = value.split("\n")
    if (lines[lines.length - 1] === "") lines.pop()
    return lines
}

export function handlePairedRemoveAdd(
    removed: string,
    added: string,
    oldLine: number,
    newLine: number
): DiffBlockResult {
    const removedLines = splitLinesAndRemoveTrailingEmpty(removed)
    const addedLines = splitLinesAndRemoveTrailingEmpty(added)
    const max = Math.max(removedLines.length, addedLines.length)
    const diffs: LineDiff[] = []
    let currentOldLine = oldLine
    let currentNewLine = newLine

    for (let j = 0; j < max; j++) {
        const oldContent = removedLines[j] ?? ""
        const newContent = addedLines[j] ?? ""

        if (oldContent && newContent) {
            diffs.push(createChangeLine(oldContent, newContent, currentOldLine, currentNewLine))
            currentOldLine++
            currentNewLine++
        } else if (oldContent) {
            diffs.push(createRemoveLine(oldContent, currentOldLine))
            currentOldLine++
        } else if (newContent) {
            diffs.push(createAddLine(newContent, currentNewLine))
            currentNewLine++
        }
    }

    return { diffs, oldLine: currentOldLine, newLine: currentNewLine }
}

export function convertDiffBlockToLineDiffs(
    cur: ChangeObject<string>,
    next: ChangeObject<string> | undefined,
    oldLine: number,
    newLine: number
): UnprocessedDiffBlockResult {
    if (cur.removed && next?.added) {
        const {
            diffs,
            oldLine: newOldLine,
            newLine: newNewLine,
        } = handlePairedRemoveAdd(cur.value, next.value, oldLine, newLine)
        return { diffs, oldLine: newOldLine, newLine: newNewLine, skipNext: true }
    }

    if (cur.added) {
        const lines = splitLinesAndRemoveTrailingEmpty(cur.value)
        const diffs = lines.map(line => createAddLine(line, newLine++))
        return { diffs, oldLine, newLine, skipNext: false }
    }

    if (cur.removed) {
        const lines = splitLinesAndRemoveTrailingEmpty(cur.value)
        const diffs = lines.map(line => createRemoveLine(line, oldLine++))
        return { diffs, oldLine, newLine, skipNext: false }
    }

    const lines = splitLinesAndRemoveTrailingEmpty(cur.value)
    const diffs = lines.map(line => createContextLine(line, oldLine++, newLine++))
    return { diffs, oldLine, newLine, skipNext: false }
}
