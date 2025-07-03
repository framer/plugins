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
        <table className="overflow-auto h-full w-full bg-[#FDFDFD] dark:bg-[#181818] font-mono text-sm border-separate border-spacing-0">
            <tbody>{rows}</tbody>
        </table>
    )
}

function ChangeRow({ line }: { line: LineDiff & { type: "change" } }) {
    return (
        <>
            <tr className="bg-[#FF3366]/10">
                <RemoveRowLineNumberCell lineNumber={line.oldLine} />
                <LineNumberCell lineNumber={undefined} />
                <ContentCell>
                    <InlineDiffs parts={line.inlineDiffs} type="remove" />
                </ContentCell>
            </tr>
            <tr className="bg-[#00CC88]/10">
                <LineNumberCell lineNumber={undefined} />
                <AddRowLineNumberCell lineNumber={line.newLine} />
                <ContentCell>
                    <InlineDiffs parts={line.inlineDiffs} type="add" />
                </ContentCell>
            </tr>
        </>
    )
}

function ContextRow({ line }: { line: LineDiff & { type: "context" } }) {
    return (
        <tr>
            <LineNumberCell lineNumber={line.oldLine} />
            <LineNumberCell lineNumber={line.newLine} />
            <ContentCell>{line.content}</ContentCell>
        </tr>
    )
}

function AddRow({ line }: { line: LineDiff & { type: "add" } }) {
    return (
        <tr className="bg-green-50">
            <LineNumberCell lineNumber={undefined} />
            <AddRowLineNumberCell lineNumber={line.newLine} />
            <ContentCell className="text-[#00CC88]/10">{line.content}</ContentCell>
        </tr>
    )
}

function RemoveRow({ line }: { line: LineDiff & { type: "remove" } }) {
    return (
        <tr className="bg-red-50">
            <RemoveRowLineNumberCell lineNumber={line.oldLine} />
            <LineNumberCell lineNumber={undefined} />
            <ContentCell className="text-[#FF3366]/10">{line.content}</ContentCell>
        </tr>
    )
}

function DividerRow() {
    return (
        <tr>
            <td colSpan={3}>
                <div className="border-b-2 border-dashed border-gray-300 my-2" />
            </td>
        </tr>
    )
}

function LineNumberCell({
    lineNumber,
    className = "text-gray-600",
    prefix = "",
}: {
    lineNumber: number | undefined
    className?: string
    prefix?: string
}) {
    return (
        <td
            className={cn(
                "text-right pr-2 pl-2 py-1 select-none min-w-8 text-[#BBBBBB] dark:text-[#555555] text-[11px]",
                className
            )}
        >
            {lineNumber !== undefined ? `${prefix}${lineNumber}` : ""}
        </td>
    )
}

function AddRowLineNumberCell({ lineNumber }: { lineNumber: number | undefined }) {
    return <LineNumberCell lineNumber={lineNumber} className="text-[#00CC88]/10 whitespace-nowrap" prefix="+" />
}

function RemoveRowLineNumberCell({ lineNumber }: { lineNumber: number | undefined }) {
    return <LineNumberCell lineNumber={lineNumber} className="text-[#FF3366]/10 whitespace-nowrap" prefix="-" />
}

function ContentCell({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <td className={cn("whitespace-pre px-2 py-1 text-[#666666] dark:text-[#EEEEEE] text-[11px]", className)}>
            {children}
        </td>
    )
}

function InlineDiffs({ parts, type }: { parts: readonly InlineDiff[]; type: "add" | "remove" }) {
    return parts.map((part, i) =>
        match([part, type] as const)
            .with([{ type: "add" }, "add"], ([part]) => (
                <mark key={i} className="bg-[#00CC88]/20">
                    {part.value}
                </mark>
            ))
            .with([{ type: "remove" }, "remove"], ([part]) => (
                <mark key={i} className="bg-[#FF015E]/20">
                    {part.value}
                </mark>
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
