import { match, P } from "ts-pattern"
import { cn } from "../utils"
import { getLineDiffWithEdges } from "../utils/diff/line-diff"
import type { InlineDiff, LineDiff } from "../utils/diff/types"

interface FileDiffProps {
    original: string
    revised: string
}

export default function FileDiff({ original, revised }: FileDiffProps) {
    const lines = getLineDiffWithEdges(original, revised)

    const rows = lines.map(line =>
        match(line)
            .returnType<React.ReactNode>()
            .with({ type: "change" }, line => <ChangeRow key={getRowKey(line)} line={line} />)
            .with({ type: "context" }, line => <ContextRow key={getRowKey(line)} line={line} />)
            .with({ type: "add" }, line => <AddRow key={getRowKey(line)} line={line} />)
            .with({ type: "remove" }, line => <RemoveRow key={getRowKey(line)} line={line} />)
            .with({ type: "divider" }, line => <DividerRow key={getRowKey(line)} />)
            .exhaustive()
    )

    return (
        <table className="font-mono text-[11px] border-separate border-spacing-0 w-full">
            <tbody>{rows}</tbody>
        </table>
    )
}

function ChangeRow({ line }: { line: LineDiff & { type: "change" } }) {
    const removeBorderClass = getEdgeBorderClass("remove", line.removeIsTopEdge, line.removeIsBottomEdge)
    const addBorderClass = getEdgeBorderClass("add", line.addIsTopEdge, line.addIsBottomEdge)

    return (
        <>
            <tr className="bg-gradient-to-r from-transparent from-0%  to-diff-remove/10 to-[35px] h-[19px] leading-[19px]">
                <RemoveRowLineNumberCell lineNumber={line.oldLine} className={removeBorderClass} />
                <LineNumberCell lineNumber={undefined} className={removeBorderClass} />
                <ContentCell className={cn("text-diff-remove dark:text-diff-remove", removeBorderClass)}>
                    <InlineDiffs parts={line.inlineDiffs} type="remove" />
                </ContentCell>
            </tr>
            <tr className="bg-gradient-to-r from-transparent from-0% to-[60px] to-diff-add-bg/10  h-[19px] leading-[19px]">
                <LineNumberCell lineNumber={undefined} className={addBorderClass} />
                <AddRowLineNumberCell lineNumber={line.newLine} className={cn("ms-1", addBorderClass)} />
                <ContentCell className={cn("text-diff-add dark:text-diff-add", addBorderClass)}>
                    <InlineDiffs parts={line.inlineDiffs} type="add" />
                </ContentCell>
            </tr>
        </>
    )
}

function ContextRow({ line }: { line: LineDiff & { type: "context" } }) {
    return (
        <tr className="h-[19px] leading-[19px]">
            <LineNumberCell lineNumber={line.oldLine} />
            <LineNumberCell lineNumber={line.newLine} />
            <ContentCell>{line.content}</ContentCell>
        </tr>
    )
}

function AddRow({ line }: { line: LineDiff & { type: "add" } }) {
    const borderClass = getEdgeBorderClass("add", line.isTopEdge, line.isBottomEdge)

    return (
        <tr className="bg-gradient-to-r from-transparent from-0% to-[60px] to-diff-add-bg/10  h-[19px] leading-[19px]">
            <LineNumberCell lineNumber={undefined} className={borderClass} />
            <AddRowLineNumberCell lineNumber={line.newLine} className={borderClass} />
            <ContentCell className={cn("text-diff-add dark:text-diff-add", borderClass)}>{line.content}</ContentCell>
        </tr>
    )
}

function RemoveRow({ line }: { line: LineDiff & { type: "remove" } }) {
    const borderClass = getEdgeBorderClass("remove", !!line.isTopEdge, !!line.isBottomEdge)

    return (
        <tr className="bg-gradient-to-r from-transparent from-0% to-[35px] to-diff-remove/10  h-[19px] leading-[19px]">
            <RemoveRowLineNumberCell lineNumber={line.oldLine} className={borderClass} />
            <LineNumberCell lineNumber={undefined} className={borderClass} />
            <ContentCell className={cn("text-diff-remove dark:text-diff-remove", borderClass)}>
                {line.content}
            </ContentCell>
        </tr>
    )
}

function DividerRow() {
    return (
        <tr className="h-[19px]">
            <td colSpan={3}>
                <div className="border-t border-framer-divider my-2" />
            </td>
        </tr>
    )
}

function LineNumberCell({
    lineNumber,
    className,
    prefix = "",
}: {
    lineNumber: number | undefined
    className?: string
    prefix?: string
}) {
    return (
        <td
            className={cn(
                "text-right select-none text-[#BBBBBB] dark:text-[#555555] pe-3 w-min",
                className
            )}
        >
            {lineNumber !== undefined ? `${prefix}${lineNumber}` : ""}
        </td>
    )
}

function AddRowLineNumberCell({ lineNumber, className }: { lineNumber: number | undefined; className?: string }) {
    return (
        <LineNumberCell
            lineNumber={lineNumber}
            className={cn("text-diff-add dark:text-diff-add whitespace-nowrap", className)}
            prefix="+"
        />
    )
}

function RemoveRowLineNumberCell({ lineNumber, className }: { lineNumber: number | undefined; className?: string }) {
    return (
        <LineNumberCell
            lineNumber={lineNumber}
            className={cn("text-diff-remove dark:text-diff-remove whitespace-nowrap", className)}
            prefix="-"
        />
    )
}

function ContentCell({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <td className={cn("whitespace-pre text-[#666666] dark:text-[#EEEEEE] w-full", className)}>
            {children}
        </td>
    )
}

function getEdgeBorderClass(type: "add" | "remove", isTopEdge = false, isBottomEdge = false): string {
    return cn({
        "border-diff-add/10": type === "add",
        "border-diff-remove/10": type === "remove",
        "border-t": isTopEdge,
        "border-b": isBottomEdge,
    })
}

function Mark({ children, className }: { children: React.ReactNode; className?: string }) {
    return <mark className={cn("h-[19px] inline-block", className)}>{children}</mark>
}

function InlineDiffs({ parts, type }: { parts: readonly InlineDiff[]; type: "add" | "remove" }) {
    return parts.map((part, i) =>
        match([part, type] as const)
            .with([{ type: "add" }, "add"], ([part]) => (
                <Mark key={i} className="bg-diff-add-bg/10 text-diff-add dark:text-diff-add">
                    {part.value}
                </Mark>
            ))
            .with([{ type: "remove" }, "remove"], ([part]) => (
                <Mark key={i} className="bg-diff-remove-bg/10 text-diff-remove dark:text-diff-remove">
                    {part.value}
                </Mark>
            ))
            .with([{ type: "unchanged" }, P._], ([part]) => <span key={i}>{part.value}</span>)
            .otherwise(() => null)
    )
}

const getRowKey = (line: LineDiff) =>
    match(line)
        .returnType<string>()
        .with({ type: "change" }, line => `change-${line.oldLine}-${line.newLine}`)
        .with({ type: "context" }, line => `context-${line.oldLine}-${line.newLine}`)
        .with({ type: "add" }, line => `add-${line.newLine}`)
        .with({ type: "remove" }, line => `remove-${line.oldLine}`)
        .with({ type: "divider" }, line => `divider-${line.line}`)
        .exhaustive()
