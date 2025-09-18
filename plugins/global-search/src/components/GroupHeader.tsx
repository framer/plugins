import { forwardRef, memo } from "react"
import { assertNever } from "../utils/assert"
import { cn } from "../utils/className"
import type { PreparedGroup } from "../utils/filter/group-results"
import type { RootNodeType } from "../utils/indexer/types"
import { useFocusHandlers } from "../utils/useFocus"
import { IconArrowRight } from "./ui/IconArrowRight"
import { IconCode } from "./ui/IconCode"
import { IconCollection } from "./ui/IconCollection"
import { IconComponent } from "./ui/IconComponent"
import { IconWebPage } from "./ui/IconWebPage"

interface GroupHeaderProps extends React.HTMLAttributes<HTMLButtonElement> {
    readonly entry: Pick<PreparedGroup["entry"], "id" | "rootNodeType" | "rootNodeName">
    readonly isExpanded: boolean
    readonly isSticky: boolean
    readonly onToggle: () => void
}

export const GroupHeader = memo(
    forwardRef<HTMLButtonElement, GroupHeaderProps>(function GroupHeader(
        { entry, isExpanded, isSticky, onToggle, className, ...props },
        ref
    ) {
        const focusProps = useFocusHandlers({ isSelfSelectable: false })
        const displayName = entry.rootNodeName ?? `Unnamed ${entry.rootNodeType}`

        return (
            <button
                ref={ref}
                onClick={onToggle}
                className={cn(
                    "group w-full pt-1 focus:outline-none bg-modal-light dark:bg-modal-dark cursor-pointer border-t border-divider-light dark:border-divider-dark transition-colors text-left h-7 mt-[4px] box-border",
                    isSticky ? "sticky top-0 z-1 border-t-transparent" : "",

                    className
                )}
                aria-expanded={isExpanded}
                {...focusProps}
                {...props}
            >
                <div className="h-6 flex flex-row gap-2 rounded-lg justify-start items-center select-none overflow-hidden ps-2 group-focus-visible:bg-option-light dark:group-focus-visible:bg-option-dark group-focus-visible:text-primary-light dark:group-focus-visible:text-primary-dark">
                    <div className="flex-shrink-0 flex gap-2 justify-start items-center">
                        <IconArrowRight
                            className={cn(
                                "text-tertiary-light dark:text-tertiary-dark transition-transform duration-200 ease-in-out",
                                isExpanded && "rotate-90"
                            )}
                            aria-hidden="true"
                        />

                        <ResultIcon rootNodeType={entry.rootNodeType} aria-hidden="true" />
                    </div>

                    <div className="text-xs text-secondary-light dark:text-secondary-dark whitespace-nowrap text-ellipsis flex-1 overflow-hidden">
                        {displayName}
                    </div>
                </div>
            </button>
        )
    })
)

const defaultIconClassName = "text-tertiary-light dark:text-tertiary-dark"

export function ResultIcon({ rootNodeType }: { rootNodeType: RootNodeType }) {
    switch (rootNodeType) {
        case "WebPageNode":
            return <IconWebPage className={defaultIconClassName} />
        case "Collection":
            return <IconCollection className={defaultIconClassName} />
        case "ComponentNode":
            return <IconComponent className={defaultIconClassName} />
        case "CodeFile":
            return <IconCode className={defaultIconClassName} />
        default:
            assertNever(rootNodeType)
    }
}
