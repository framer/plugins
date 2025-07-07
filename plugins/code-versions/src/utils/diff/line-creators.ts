import { getInlineDiff } from "./inline-diff"
import type { LineDiff } from "./types"

const NEWLINE = "\n"

export function createContextLine(content: string, oldLine: number, newLine: number): LineDiff {
    return {
        type: "context",
        content: content + NEWLINE,
        oldLine,
        newLine,
    }
}

export function createAddLine(content: string, newLine: number): LineDiff {
    return {
        type: "add",
        content: content + NEWLINE,
        oldLine: null,
        newLine,
    }
}

export function createRemoveLine(content: string, oldLine: number): LineDiff {
    return {
        type: "remove",
        content: content + NEWLINE,
        oldLine,
        newLine: null,
    }
}

export function createChangeLine(oldContent: string, newContent: string, oldLine: number, newLine: number): LineDiff {
    return {
        type: "change",
        oldLine,
        newLine,
        oldContent: oldContent + NEWLINE,
        newContent: newContent + NEWLINE,
        inlineDiffs: getInlineDiff(oldContent, newContent),
    }
}

export function createDividerLine(line: number): LineDiff {
    return {
        type: "divider",
        line,
    }
}
