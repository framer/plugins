import { match, P } from "ts-pattern"
import { cn } from "../utils"
import { getLineDiff } from "../utils/diff/line-diff"
import type { InlineDiff, LineDiff } from "../utils/diff/types"

interface FileDiffProps {
    original: string
    revised: string
}

export default function FileDiff({ original, revised }: FileDiffProps) {
    const lines = getLineDiff(original, revised)

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
        <div className="absolute inset-0 ms-3 me-4 mt-3 overflow-auto ">
            <table className="font-mono text-sm border-separate border-spacing-0 w-full">
                <tbody>{rows}</tbody>
            </table>
        </div>
    )
}

function ChangeRow({ line }: { line: LineDiff & { type: "change" } }) {
    return (
        <>
            <tr className="bg-gradient-to-r from-transparent from-0%  to-diff-remove/10 to-[35px] h-[19px] leading-[19px]">
                <RemoveRowLineNumberCell lineNumber={line.oldLine} className="ms-1" />
                <LineNumberCell lineNumber={undefined} />
                <ContentCell className="text-diff-remove dark:text-diff-remove">
                    <InlineDiffs parts={line.inlineDiffs} type="remove" />
                </ContentCell>
            </tr>
            <tr className="bg-gradient-to-r from-transparent from-0% to-[35px] to-diff-add-bg/10  h-[19px] leading-[19px]">
                <LineNumberCell lineNumber={undefined} />
                <AddRowLineNumberCell lineNumber={line.newLine} className="ms-1" />
                <ContentCell className="text-diff-add dark:text-diff-add">
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
    return (
        <tr className="bg-gradient-to-r from-transparent from-0% to-[60px] to-diff-add-bg/10  h-[19px] leading-[19px]">
            <LineNumberCell lineNumber={undefined} />
            <AddRowLineNumberCell lineNumber={line.newLine} />
            <ContentCell className="text-diff-add dark:text-diff-add">{line.content}</ContentCell>
        </tr>
    )
}

function RemoveRow({ line }: { line: LineDiff & { type: "remove" } }) {
    return (
        <tr className="bg-gradient-to-r from-transparent from-0% to-[35px] to-diff-remove/10  h-[19px] leading-[19px]">
            <RemoveRowLineNumberCell lineNumber={line.oldLine} />
            <LineNumberCell lineNumber={undefined} />
            <ContentCell className="text-diff-remove dark:text-diff-remove">{line.content}</ContentCell>
        </tr>
    )
}

function DividerRow() {
    return (
        <tr className="h-[19px]">
            <td colSpan={3}>
                <div className="border-b-2 border-dashed border-gray-300" />
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
                "text-right select-none text-[#BBBBBB] dark:text-[#555555] text-[11px] pe-3 w-min",
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
        <td className={cn("whitespace-pre text-[#666666] dark:text-[#EEEEEE] text-[11px] w-full", className)}>
            {children}
        </td>
    )
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
        .with({ type: "divider" }, line => `divider-${line.betweenLines?.join("-")}`)
        .exhaustive()
