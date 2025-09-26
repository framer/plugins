import { forwardRef, memo } from "react"
import { assertNever } from "../utils/assert"
import { cn } from "../utils/className"
import type { PreparedGroup } from "../utils/filter/group-results"
import type { RootNodeType } from "../utils/indexer/types"
import { headerId } from "../utils/selection/constants"
import { useSelection } from "../utils/selection/useSelection"
import { IconArrowRight } from "./ui/IconArrowRight"
import { IconCode } from "./ui/IconCode"
import { IconCollection } from "./ui/IconCollection"
import { IconComponent } from "./ui/IconComponent"
import { IconWebPage } from "./ui/IconWebPage"

interface GroupHeaderProps extends React.HTMLAttributes<HTMLButtonElement> {
    readonly index: number
    readonly entry: Pick<PreparedGroup["entry"], "id" | "rootNodeType" | "rootNodeName">
    readonly isExpanded: boolean
    readonly isSticky: boolean
    readonly showFadeOut: boolean
    readonly onToggle: () => void
}

export const GroupHeader = memo(
    forwardRef<HTMLButtonElement, GroupHeaderProps>(function GroupHeader(
        { entry, isExpanded, isSticky, onToggle, className, showFadeOut, index, ...props },
        ref
    ) {
        const { getFocusProps } = useSelection()
        const displayName = entry.rootNodeName ?? `Unnamed ${entry.rootNodeType}`

        return (
            <button
                tabIndex={-1}
                ref={ref}
                onClick={onToggle}
                className={cn(
                    "group w-full focus:outline-none cursor-pointer text-left",
                    isSticky ? "sticky -top-px z-1" : "",
                    showFadeOut &&
                        "after:content-[] after:absolute after:top-7 after:left-0 after:right-0 after:h-3 after:z-10 after:pointer-events-none after:bg-gradient-to-b after:from-modal-light dark:after:from-modal-dark after:to-transparent",
                    className
                )}
                aria-expanded={isExpanded}
                data-index={index}
                {...props}
                {...getFocusProps(headerId(entry.id))}
            >
                <div className="bg-modal-light dark:bg-modal-dark mt-1">
                    <hr
                        className="border-divider-light dark:border-divider-dark aria-hidden:opacity-0 mb-1"
                        aria-hidden={index === 0}
                    />
                    <div className="h-6 flex flex-row gap-2 rounded-lg justify-start items-center select-none overflow-hidden ps-2 group-focus-visible:bg-option-light dark:group-focus-visible:bg-option-dark group-focus-visible:text-primary-light dark:group-focus-visible:text-primary-dark">
                        <div className="flex-shrink-0 flex gap-2 justify-start items-center">
                            <IconArrowRight
                                className={cn(
                                    "text-tertiary-light dark:text-secondary-dark transition-transform duration-200 ease-in-out",
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
                </div>
            </button>
        )
    })
)

const defaultIconClassName = "text-tertiary-light dark:text-secondary-dark"

export function ResultIcon({ rootNodeType }: { rootNodeType: RootNodeType }) {
    switch (rootNodeType) {
        case "WebPageNode":
        case "DesignPageNode":
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
