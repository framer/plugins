import type { CodeFileVersion } from "framer-plugin"
import { Tooltip } from "../components/Tooltip"
import { cn } from "../utils"

function formatRelative(date: Date): string {
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000
    if (diff < 60) return `${Math.floor(diff)}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString()
}

function formatFull(date: Date): string {
    return (
        `${date.getFullYear().toString().slice(2)}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}` +
        ` \u2022 ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toLowerCase()}`
    )
}

function Version({
    version,
    isSelected,
    onSelect,
}: {
    version: CodeFileVersion
    isSelected: boolean
    onSelect: (id: string) => void
}) {
    const createdAtDate = new Date(version.createdAt)

    return (
        <Tooltip content={formatFull(createdAtDate)} side="bottom" align="center">
            <div
                className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer select-none group relative w-full",
                    isSelected ? "bg-gray-100 rounded-xl" : "",
                    "transition-colors"
                )}
                tabIndex={0}
                onClick={() => onSelect(version.id)}
            >
                <span
                    className={cn(
                        "font-semibold",
                        isSelected ? "text-gray-700" : "text-gray-900 group-hover:text-gray-700"
                    )}
                >
                    {formatRelative(createdAtDate)}
                </span>
                <span className="mx-1 text-gray-300">&bull;</span>
                <span className={cn(isSelected ? "text-gray-500" : "text-gray-400 group-hover:text-gray-500")}>
                    {"author" in version ? (version as any).author : version.id}
                </span>
            </div>
        </Tooltip>
    )
}

export default function VersionsSidebar({
    className,
    versions,
    selectedId,
    onSelect,
    isLoading,
}: {
    className?: string
    versions: readonly CodeFileVersion[]
    selectedId?: string
    onSelect: (id: string) => void
    isLoading?: boolean
}) {
    return (
        <aside className={cn("bg-bg-secondary flex flex-col px-0 py-0 h-full border-r border-gray-100", className)}>
            <div className="h-px bg-gray-200 w-full mb-1" />
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">Loading versions...</div>
                ) : (
                    versions.map(version => (
                        <Version
                            key={version.id}
                            version={version}
                            isSelected={version.id === selectedId}
                            onSelect={onSelect}
                        />
                    ))
                )}
            </div>
        </aside>
    )
}
