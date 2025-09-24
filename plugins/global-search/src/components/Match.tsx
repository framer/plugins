import { framer } from "framer-plugin"
import { type CSSProperties, forwardRef, useCallback, useMemo } from "react"
import { cn } from "../utils/className"
import { type Range, rangeLength, rangeToCodeFileLocation } from "../utils/filter/ranges"
import { ResultType } from "../utils/filter/types"
import { useSelection } from "../utils/selection/useSelection"
import { truncateFromStart } from "../utils/text"

interface CommonMatchProps {
    targetId: string
    text: string
    range: Range
    style?: CSSProperties | undefined
    className?: string | undefined
    resultId: string
}

type TypedMatchProps =
    | {
          type: ResultType.CollectionItemField
          collectionFieldId: string
      }
    | {
          type: Exclude<ResultType, ResultType.CollectionItemField>
          collectionFieldId?: never
      }

export type MatchProps = CommonMatchProps & TypedMatchProps

export const Match = forwardRef<HTMLButtonElement, MatchProps>(function Match(props, ref) {
    const { targetId, text, range, style, className, resultId } = props
    const navigateToResult = useCallback(() => {
        framer
            .navigateTo(targetId, {
                scrollTo: getScrollToForMatch(range, text, props),
                zoomIntoView: {
                    maxZoom: 1,
                },
            })
            .catch((error: unknown) => {
                framer.notify(`Failed to go to item. ${error instanceof Error ? error.message : "Unknown error"}`)
            })
    }, [targetId, range, text, props])

    const { before, highlight, after } = useHighlightedTextWithContext({ text, range })
    const { activeId, getFocusProps } = useSelection()
    const isActive = activeId === resultId

    return (
        <button
            ref={ref}
            tabIndex={-1}
            onClick={navigateToResult}
            className={cn(
                "text-secondary-light dark:text-secondary-dark text-xs w-full text-left select-none pl-5 pr-1 rounded-lg h-6 left-0 scroll-m-8",
                "hover:bg-option-light/50 dark:hover:bg-option-dark/50 hover:text-primary-light dark:hover:text-primary-dark",
                "aria-selected:bg-option-light dark:aria-selected:bg-option-dark aria-selected:text-primary-light dark:aria-selected:text-primary-dark",
                "focus:outline-none focus:ring-0 focus:ring-offset-0",
                className
            )}
            style={style}
            role="option"
            aria-selected={isActive}
            {...getFocusProps(resultId)}
        >
            <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                {before}
                <span className="font-semibold bg-transparent text-primary-light dark:text-primary-dark">
                    {highlight}
                </span>
                {after}
            </div>
        </button>
    )
})

function getScrollToForMatch(range: Range, text: string, typedMatchProps: TypedMatchProps) {
    switch (typedMatchProps.type) {
        case ResultType.CollectionItemField:
            return { collectionFieldId: typedMatchProps.collectionFieldId }
        case ResultType.CodeFile:
            return { codeFilePosition: rangeToCodeFileLocation(range, text) }
        default:
            return undefined
    }
}

const rowLength = 30
function useHighlightedTextWithContext({ text, range }: { text: string; range: Range }) {
    const [start, end] = range
    const maxBeforeLength = Math.floor((rowLength - rangeLength(range)) / 2)
    const before = text.slice(0, start)
    const highlight = text.slice(start, end)
    const after = text.slice(end)

    const limitedBefore = useMemo(
        () => (text.length < rowLength ? before : truncateFromStart(before, maxBeforeLength)),
        [before, text, maxBeforeLength]
    )

    return { before: limitedBefore, highlight: highlight, after }
}
