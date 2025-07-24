import { diffLines } from "diff"
import { assert } from "../../utils"
import { addContextLimitingAndDividers } from "./context-limiter"
import { createAddLine, createChangeLine, createContextLine, createRemoveLine } from "./line-creators"
import type { LineDiff } from "./types"

/**
 * Result of converting a diff block to line diffs.
 *
 * @param diffs - Array of line diff objects
 * @param oldLine - Updated line number for the old file
 * @param newLine - Updated line number for the new file
 * @param skipNext - When true, indicates that the next diff block was already processed
 *                   as part of a paired remove/add operation, so it should be skipped
 *                   to avoid double-processing the same content.
 */
interface DiffBlockResult {
    diffs: LineDiff[]
    oldLine: number
    newLine: number
    skipNext: boolean
}

/**
 * Generates a line-by-line diff between two strings with context limiting and dividers.
 *
 * @param oldStr - The original string to compare
 * @param newStr - The revised string to compare against
 * @returns An array of LineDiff objects representing the differences
 */
export function getLineDiff(oldStr: string, newStr: string): LineDiff[] {
    const rawDiffs = diffLines(oldStr, newStr)
    const result: LineDiff[] = []
    let oldLine = 1
    let newLine = 1

    for (let i = 0; i < rawDiffs.length; i += 1) {
        const currentDiff = rawDiffs[i]
        assert(currentDiff !== undefined, "currentDiff is undefined")

        const nextDiff = rawDiffs[i + 1]
        const {
            diffs,
            oldLine: updatedOldLine,
            newLine: updatedNewLine,
            skipNext,
        } = convertDiffBlockToLineDiffs(currentDiff, nextDiff, oldLine, newLine)

        result.push(...diffs)
        oldLine = updatedOldLine
        newLine = updatedNewLine
        // If skipNext is true, it means we processed both current and next diff blocks together
        // as a paired remove/add operation, so we need to skip the next iteration to avoid
        // processing the same block twice.
        if (skipNext) {
            i += 1
        }
    }

    return addContextLimitingAndDividers(result)
}

/**
 * Generates a line-by-line diff between two strings with context limiting and dividers,
 * and adds edge information to each line.
 *
 * @param oldStr - The original string to compare
 * @param newStr - The revised string to compare against
 * @returns An array of LineDiff objects representing the differences with edge information
 */
export function getLineDiffWithEdges(oldStr: string, newStr: string): LineDiff[] {
    const lines = getLineDiff(oldStr, newStr)
    return lines.map((line, i, arr) => {
        switch (line.type) {
            case "add":
            case "remove":
                return {
                    ...line,
                    isTopEdge: isTopEdge(arr, i, line.type),
                    isBottomEdge: isBottomEdge(arr, i, line.type),
                }
            case "change":
                return {
                    ...line,
                    removeIsTopEdge: isTopEdge(arr, i, "remove"),
                    removeIsBottomEdge: isBottomEdge(arr, i, "remove"),
                    addIsTopEdge: isTopEdge(arr, i, "add"),
                    addIsBottomEdge: isBottomEdge(arr, i, "add"),
                }
            default:
                return line
        }
    })
}

/**
 * Diff block processing for converting raw diff output into structured LineDiff objects.
 */

function splitLinesAndRemoveTrailingEmpty(value: string): string[] {
    const lines = value.split("\n")
    if (lines[lines.length - 1] === "") lines.pop()
    return lines
}

/**
 * Handles paired remove/add operations (which represent changes in line).
 */
function handlePairedRemoveAdd(
    removed: string,
    added: string,
    oldLine: number,
    newLine: number
): { diffs: LineDiff[]; oldLine: number; newLine: number } {
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

/**
 * Converts a single diff block from the 'diff' library into our LineDiff format.
 */
function convertDiffBlockToLineDiffs(
    cur: ReturnType<typeof diffLines>[number],
    next: ReturnType<typeof diffLines>[number] | undefined,
    oldLine: number,
    newLine: number
): DiffBlockResult {
    // Handle paired remove/add (change in line)
    if (cur.removed && next?.added) {
        const {
            diffs,
            oldLine: newOldLine,
            newLine: newNewLine,
        } = handlePairedRemoveAdd(cur.value, next.value, oldLine, newLine)
        return { diffs, oldLine: newOldLine, newLine: newNewLine, skipNext: true }
    }

    // Handle single additions
    if (cur.added) {
        const lines = splitLinesAndRemoveTrailingEmpty(cur.value)
        const diffs = lines.map(line => createAddLine(line, newLine++))
        return { diffs, oldLine, newLine, skipNext: false }
    }

    // Handle single removals
    if (cur.removed) {
        const lines = splitLinesAndRemoveTrailingEmpty(cur.value)
        const diffs = lines.map(line => createRemoveLine(line, oldLine++))
        return { diffs, oldLine, newLine, skipNext: false }
    }

    // Handle unchanged content (context)
    const lines = splitLinesAndRemoveTrailingEmpty(cur.value)
    const diffs = lines.map(line => createContextLine(line, oldLine++, newLine++))
    return { diffs, oldLine, newLine, skipNext: false }
}

function isTopEdge(arr: LineDiff[], i: number, type: LineDiff["type"]): boolean {
    const prev = arr[i - 1]
    if (!prev) return true
    if (type === "add" && prev.type === "change") return false
    if (type === "remove" && prev.type === "change") return false
    return prev.type !== type
}

function isBottomEdge(arr: LineDiff[], i: number, type: LineDiff["type"]): boolean {
    const next = arr[i + 1]
    if (!next) return true
    switch (type) {
        case "remove":
            if (next.type === "change") return false
            return next.type !== "remove"
        case "add":
            if (next.type === "change") return true
            return next.type !== "add"
        default:
            return next.type !== type
    }
}
