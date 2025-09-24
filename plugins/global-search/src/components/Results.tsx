import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "../utils/className"
import type { PreparedGroup, PreparedResult } from "../utils/filter/group-results"
import { ResultType } from "../utils/filter/types"
import { headerId } from "../utils/selection/constants"
import { useSelection } from "../utils/selection/useSelection"
import { GroupHeader } from "./GroupHeader"
import { Match } from "./Match"

interface ResultsProps {
    readonly groups: readonly PreparedGroup[]
}

export function ResultsList({ groups }: ResultsProps) {
    const scrollElementRef = useRef<HTMLDivElement>(null)
    const activeStickyIndexRef = useRef(0)
    const { collapsedGroups, toggleGroup } = useCollapsedGroups()
    const { virtualItems, virtualItemIds, stickyIndexes } = useProcessedResults(groups, collapsedGroups)
    const { setItems } = useSelection()

    const rowVirtualizer = useVirtualizer({
        overscan: 10,
        count: virtualItems.length,
        getScrollElement: () => scrollElementRef.current,
        estimateSize: index => {
            const item = virtualItems[index]
            if (!item) return 0
            const nextItem = virtualItems[index + 1]
            const isLastMatchInGroup = nextItem?.groupId !== item.groupId

            if (item.type === "group-header") return isLastMatchInGroup ? 40 : 35

            return isLastMatchInGroup ? 35 : 30
        },
        rangeExtractor: range => {
            // TODO: This sticky index could be added and put into the result more efficiently
            activeStickyIndexRef.current = stickyIndexes.findLast(index => range.startIndex >= index) ?? 0
            const next = new Set([activeStickyIndexRef.current, ...defaultRangeExtractor(range)])
            return [...next].sort((a, b) => a - b)
        },
        getItemKey: index => {
            const item = virtualItems[index]
            if (!item) return index
            return item.type === "group-header" ? `header:${item.groupId}` : `result:${item.resultId}`
        },
    })

    useEffect(() => {
        setItems(virtualItemIds)
    }, [virtualItemIds, setItems])

    return (
        <div
            ref={scrollElementRef}
            className="flex-1 min-h-0 overflow-auto scrollbar-hidden contain-strict focus-visible:outline-focus-ring-light focus-visible:dark:outline-focus-ring-dark focus-visible:outline-2 rounded-lg"
            role="listbox"
            aria-label="Search results"
        >
            <div className="relative w-full mb-3" style={{ height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const item = virtualItems[virtualRow.index]
                    if (!item) return null

                    const isLastMatchInGroup = virtualItems[virtualRow.index + 1]?.groupId !== item.groupId

                    const rowStyle = {
                        transform: `translateY(${virtualRow.start}px)`,
                    } satisfies CSSProperties

                    const isSticky = activeStickyIndexRef.current === virtualRow.index
                    const rowClassName = cn(
                        "w-full left-0",
                        isSticky ? "sticky" : "absolute",
                        item.type === "group-header" ? "z-2" : "z-0",
                        isLastMatchInGroup && "mb-1"
                    )

                    if (item.type === "group-header") {
                        const hasScrolled = (scrollElementRef.current?.scrollTop ?? 0) > 0
                        return (
                            <GroupHeader
                                key={virtualRow.key}
                                ref={rowVirtualizer.measureElement}
                                entry={item.entry}
                                isExpanded={item.isExpanded}
                                onToggle={() => {
                                    toggleGroup(item.groupId)
                                }}
                                isSticky={isSticky}
                                showFadeOut={isSticky && hasScrolled}
                                hasTopBorder={isSticky ? hasScrolled : true}
                                style={!isSticky ? rowStyle : undefined}
                                className={rowClassName}
                            />
                        )
                    }

                    if (item.result.type === ResultType.CollectionItemField) {
                        return (
                            <Match
                                key={virtualRow.key}
                                ref={rowVirtualizer.measureElement}
                                type={ResultType.CollectionItemField}
                                collectionFieldId={item.result.matchingField.id}
                                resultId={item.resultId}
                                targetId={item.result.entry.collectionItemId}
                                text={item.result.text}
                                range={item.result.range}
                                style={rowStyle}
                                className={rowClassName}
                            />
                        )
                    }

                    return (
                        <Match
                            key={virtualRow.key}
                            ref={rowVirtualizer.measureElement}
                            type={item.result.type}
                            resultId={item.resultId}
                            targetId={item.result.entry.nodeId}
                            text={item.result.text}
                            range={item.result.range}
                            style={rowStyle}
                            className={rowClassName}
                        />
                    )
                })}
            </div>
        </div>
    )
}

interface BaseVirtualItem {
    readonly groupId: string
}

interface GroupHeaderVirtualItem extends BaseVirtualItem {
    readonly type: "group-header"
    readonly entry: Pick<PreparedGroup["entry"], "id" | "rootNodeType" | "rootNodeName">
    readonly isExpanded: boolean
}

interface ResultVirtualItem extends BaseVirtualItem {
    readonly type: "result"
    readonly result: PreparedResult
    readonly resultId: string
}

type VirtualItem = GroupHeaderVirtualItem | ResultVirtualItem

function useCollapsedGroups(): { collapsedGroups: ReadonlySet<string>; toggleGroup: (groupId: string) => void } {
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

    const toggleGroup = useCallback((groupId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) {
                next.delete(groupId)
            } else {
                next.add(groupId)
            }
            return next
        })
    }, [])

    return { collapsedGroups, toggleGroup }
}

function useProcessedResults(
    groupedResults: readonly PreparedGroup[],
    collapsedGroups: ReadonlySet<string>
): { virtualItems: readonly VirtualItem[]; stickyIndexes: readonly number[]; virtualItemIds: readonly string[] } {
    return useMemo(() => {
        const virtualItems: VirtualItem[] = []
        const virtualItemIds: string[] = []
        const stickyIndexes: number[] = []

        for (const group of groupedResults) {
            const isExpanded = !collapsedGroups.has(group.entry.id)

            stickyIndexes.push(virtualItems.length)

            virtualItemIds.push(headerId(group.entry.id))
            virtualItems.push({
                type: "group-header",
                groupId: group.entry.id,
                entry: group.entry,
                isExpanded,
            })

            // Add results to virtual items only if expanded
            if (isExpanded) {
                for (const processed of group.matches) {
                    virtualItemIds.push(processed.id)
                    virtualItems.push({
                        type: "result",
                        groupId: group.entry.id,
                        result: processed,
                        resultId: processed.id,
                    })
                }
            }
        }

        return { virtualItems, stickyIndexes, virtualItemIds }
    }, [groupedResults, collapsedGroups])
}
