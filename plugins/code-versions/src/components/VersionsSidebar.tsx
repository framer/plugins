import type { CodeFileVersion } from "framer-plugin"
import { Tooltip } from "../components/Tooltip"
import { cn } from "../utils"
import { formatFull } from "../utils/date"
import { FormatFromNow } from "./FormatFromNow"

interface VersionProps {
    version: CodeFileVersion
    isSelected: boolean
    onSelect: (id: string) => void
}

function Version({ version, isSelected, onSelect, children }: VersionProps & { children: React.ReactNode }) {
    return (
        <Tooltip content={formatFull(version.createdAt)} side="bottom" align="center">
            <div
                className={cn(
                    "flex items-center flex-nowrap gap-2 px-2 py-[8px] cursor-pointer select-none group relative w-full",
                    isSelected ? "bg-gray-100 rounded-xl" : "",
                    "transition-colors"
                )}
                tabIndex={0}
                onClick={() => onSelect(version.id)}
            >
                {children}
            </div>
        </Tooltip>
    )
}

function CurrentVersion({ version, isSelected, onSelect }: VersionProps) {
    return (
        <Version version={version} isSelected={isSelected} onSelect={onSelect}>
            <span
                className={cn(
                    "font-semibold",
                    isSelected ? "text-gray-700" : "text-gray-900 group-hover:text-gray-700"
                )}
            >
                Current
            </span>
            <span className="text-gray-300">&bull;</span>
            <span
                className={cn(
                    "flex-1 min-w-0 truncate",
                    isSelected ? "text-gray-500" : "text-gray-400 group-hover:text-gray-500"
                )}
            >
                {version.createdBy.name}
            </span>
        </Version>
    )
}

function HistoricalVersion({ version, isSelected, onSelect }: VersionProps) {
    return (
        <Version version={version} isSelected={isSelected} onSelect={onSelect}>
            <span
                className={cn(
                    "font-semibold tabular-nums",
                    isSelected ? "text-gray-700" : "text-gray-900 group-hover:text-gray-700"
                )}
            >
                <FormatFromNow date={version.createdAt} />
            </span>
            <span className="text-gray-300">&bull;</span>
            <span
                className={cn(
                    "flex-1 min-w-0 truncate",
                    isSelected ? "text-gray-500" : "text-gray-400 group-hover:text-gray-500"
                )}
            >
                {version.createdBy.name}
            </span>
        </Version>
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
    const [currentVersion, ...historicalVersions] = versions

    return (
        <aside className={cn("bg-bg-secondary flex flex-col px-0 py-0 h-full border-r border-gray-100", className)}>
            <div className="h-px bg-gray-200 w-full mb-1" />
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">Loading versions...</div>
                ) : (
                    <>
                        {currentVersion && (
                            <CurrentVersion
                                version={currentVersion}
                                isSelected={currentVersion.id === selectedId}
                                onSelect={onSelect}
                            />
                        )}
                        {historicalVersions.length > 0 && (
                            <>
                                <div className="h-px bg-gray-200 w-full my-2" />
                                {historicalVersions.map(version => (
                                    <HistoricalVersion
                                        key={version.id}
                                        version={version}
                                        isSelected={version.id === selectedId}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>
        </aside>
    )
}
