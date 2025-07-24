import type { CodeFileVersion } from "framer-plugin"
import { useMemo } from "react"
import { cn } from "../utils"
import { FormatFromNow } from "./FormatFromNow"

interface VersionProps {
    version: CodeFileVersion
    isSelected: boolean
    onSelect: (id: string) => void
}

function Version({
    version,
    isSelected,
    onSelect,
    timestamp,
    name,
}: VersionProps & {
    timestamp: React.ReactNode
    name: string
}) {
    const createdAt = useMemo(() => new Date(version.createdAt), [version.createdAt])

    return (
        <button
            className="h-[34px] px-2 select-none relative w-full font-medium transition-colors text-left aria-selected:bg-framer-bg-tertiary rounded-lg bg-transparent cursor-pointer aria-selected:cursor-default"
            onClick={() => {
                onSelect(version.id)
            }}
            aria-selected={isSelected}
        >
            <span className="sr-only">
                Select this version, published on {createdAt.toLocaleDateString()} by {name}, to compare
            </span>
            <span className="font-semibold text-framer-text-primary tabular-nums">{timestamp}</span>
            <span className="text-framer-text-secondary contents">
                <span className="mx-1">&middot;</span>
                <span className="flex-1 min-w-0 truncate">{name}</span>
            </span>
        </button>
    )
}

function CurrentVersion({ version, isSelected, onSelect }: VersionProps) {
    return (
        <Version
            version={version}
            isSelected={isSelected}
            onSelect={onSelect}
            timestamp="Current"
            name={version.createdBy.name}
        />
    )
}

function HistoricalVersion({ version, isSelected, onSelect }: VersionProps) {
    return (
        <Version
            version={version}
            isSelected={isSelected}
            onSelect={onSelect}
            timestamp={<FormatFromNow date={version.createdAt} />}
            name={version.createdBy.name}
        />
    )
}

export function VersionsSidebar({
    className,
    versions,
    selectedId,
    onSelect,
}: VersionsListProps & {
    className?: string
}) {
    return (
        <aside
            className={cn(
                "relative flex flex-col h-full border-r border-framer-divider",
                "after:absolute after:inset-x-0 w-versions after:bottom-0 after:h-6 after:pointer-events-none after:bg-gradient-to-t after:from-framer-bg-base after:to-transparent",

                className
            )}
        >
            <VersionsList versions={versions} selectedId={selectedId} onSelect={onSelect} />
        </aside>
    )
}

interface VersionsListProps {
    versions: readonly CodeFileVersion[]
    selectedId: string | undefined
    onSelect: (id: string) => void
}

function VersionsList({ versions, selectedId, onSelect }: VersionsListProps) {
    if (versions.length === 0) return null

    const [currentVersion, ...historicalVersions] = versions

    return (
        <div className="animate-(--fade-in-animation) flex flex-col overflow-hidden">
            {currentVersion && (
                <div className="px-3 pt-3 space-y-3">
                    <CurrentVersion
                        version={currentVersion}
                        isSelected={currentVersion.id === selectedId}
                        onSelect={onSelect}
                    />
                    <hr className="h-px bg-framer-divider w-full" />
                </div>
            )}
            <div className="overflow-y-auto h-full flex-1 px-3 pt-3 scrollbar-hidden pb-6">
                {historicalVersions.map(version => (
                    <HistoricalVersion
                        key={version.id}
                        version={version}
                        isSelected={version.id === selectedId}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    )
}
