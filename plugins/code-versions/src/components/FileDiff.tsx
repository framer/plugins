import { match, P } from "ts-pattern"
import { cn } from "../utils"
import { getLineDiffWithEdges } from "../utils/diff/line-diff"
import type { InlineDiff, LineDiff } from "../utils/diff/types"

interface FileDiffProps {
    original: string
    revised: string
}

export function FileDiff({ original, revised }: FileDiffProps) {
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
        <table className="font-mono text-code border-separate border-spacing-0 w-full animate-(--fade-in-animation)">
            <tbody>{rows}</tbody>
        </table>
    )
}

function ChangeRow({ line }: { line: LineDiff & { type: "change" } }) {
    const removeBorderClass = getEdgeBorderClass("remove", line.removeIsTopEdge, line.removeIsBottomEdge)
    const addBorderClass = getEdgeBorderClass("add", line.addIsTopEdge, line.addIsBottomEdge)

    return (
        <>
            <tr className="bg-gradient-to-r from-transparent from-0%  to-diff-remove/10 to-[35px] h-(--code-row-height) leading-(--code-row-height)">
                <LineNumberCell variant="remove" lineNumber={line.oldLine} className={removeBorderClass} />
                <LineNumberCell variant="context" lineNumber={undefined} className={removeBorderClass} />
                <ContentCell className={cn("text-diff-remove dark:text-diff-remove", removeBorderClass)}>
                    <InlineDiffs parts={line.inlineDiffs} type="remove" />
                </ContentCell>
            </tr>
            <tr className="bg-gradient-to-r from-transparent from-0% to-[35px] to-diff-add-bg/10  h-(--code-row-height) leading-(--code-row-height)">
                <LineNumberCell variant="context" lineNumber={undefined} className={addBorderClass} />
                <LineNumberCell variant="add" lineNumber={line.newLine} className={cn("ms-1", addBorderClass)} />
                <ContentCell className={cn("text-diff-add dark:text-diff-add", addBorderClass)}>
                    <InlineDiffs parts={line.inlineDiffs} type="add" />
                </ContentCell>
            </tr>
        </>
    )
}

function ContextRow({ line }: { line: LineDiff & { type: "context" } }) {
    return (
        <tr className="h-(--code-row-height) leading-(--code-row-height)">
            <LineNumberCell variant="context" lineNumber={line.oldLine} />
            <LineNumberCell variant="context" lineNumber={line.newLine} />
            <ContentCell>{line.content}</ContentCell>
        </tr>
    )
}

function AddRow({ line }: { line: LineDiff & { type: "add" } }) {
    const borderClass = getEdgeBorderClass("add", line.isTopEdge, line.isBottomEdge)

    return (
        <tr className="bg-gradient-to-r from-transparent from-0% to-[35px] to-diff-add-bg/10  h-(--code-row-height) leading-(--code-row-height)">
            <td className={borderClass} />
            <LineNumberCell variant="add" lineNumber={line.newLine} className={borderClass} />
            <ContentCell className={cn("text-diff-add dark:text-diff-add", borderClass)}>{line.content}</ContentCell>
        </tr>
    )
}

function RemoveRow({ line }: { line: LineDiff & { type: "remove" } }) {
    const borderClass = getEdgeBorderClass("remove", !!line.isTopEdge, !!line.isBottomEdge)

    return (
        <tr className="bg-gradient-to-r from-transparent from-0% to-[35px] to-diff-remove/10  h-(--code-row-height) leading-(--code-row-height)">
            <LineNumberCell variant="remove" lineNumber={line.oldLine} className={borderClass} />
            <td className={borderClass} />
            <ContentCell className={cn("text-diff-remove dark:text-diff-remove", borderClass)}>
                {line.content}
            </ContentCell>
        </tr>
    )
}

function DividerRow() {
    return (
        <tr className="h-(--code-row-height)">
            <td colSpan={3}>
                <div className="border-t border-framer-divider my-2" />
            </td>
        </tr>
    )
}

function LineNumberCell({
    variant,
    lineNumber,
    className,
}: {
    variant: "add" | "remove" | "context"
    lineNumber: number | undefined
    className?: string
}) {
    const prefix = {
        add: "+",
        remove: "-",
        context: "",
    }[variant]

    return (
        <td
            className={cn(
                "text-right select-none pe-3",
                {
                    "text-diff-add dark:text-diff-add whitespace-nowrap": variant === "add",
                    "text-diff-remove dark:text-diff-remove whitespace-nowrap": variant === "remove",
                    "text-line-number": variant === "context",
                },
                className
            )}
        >
            {/* 
            min-w-7 is enough for stable three digits, after it pushes to the side. 
            This is to avoid the line number from being different between files
            */}
            <span className="min-w-7 inline-block">{lineNumber !== undefined ? `${prefix}${lineNumber}` : ""}</span>
        </td>
    )
}

function ContentCell({ children, className }: { children: React.ReactNode; className?: string }) {
    return <td className={cn("whitespace-pre text-code-primary w-full", className)}>{children}</td>
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
    return <mark className={cn("h-(--code-row-height) inline-block", className)}>{children}</mark>
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
