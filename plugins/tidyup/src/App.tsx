import {
    type CanvasNode,
    type CanvasRootNode,
    framer,
    isComponentNode,
    isVectorSetNode,
    isWebPageNode,
    supportsPins,
    useIsAllowedTo,
} from "framer-plugin"
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react"
import "./App.css"
import * as v from "valibot"
import { isNumber } from "./isNumber"
import { Stepper } from "./Stepper"

void framer.showUI({
    position: "top right",
    width: 260,
    height: 350,
    resizable: false,
})

function useCanvasRoot() {
    const [root, setRoot] = useState<CanvasRootNode | null>(null)

    useEffect(() => {
        return framer.subscribeToCanvasRoot(setRoot)
    }, [])

    return root
}

function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}

interface Point {
    x: number
    y: number
}

interface Size {
    width: number
    height: number
}

interface Rect extends Point, Size {}

function isRect(value: unknown): value is Rect {
    if (!isObject(value)) return false
    if (!isNumber(value.x)) return false
    if (!isNumber(value.y)) return false
    if (!isNumber(value.width)) return false
    if (!isNumber(value.height)) return false
    return true
}

type RectByGroundNodeId = Record<string, Rect | null>

const noRectByGroundNodeId: RectByGroundNodeId = {}

function isDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (isArray(a) && isArray(b)) {
        if (a.length !== b.length) return false
        return a.every((value, index) => isDeepEqual(value, b[index]))
    }
    if (isObject(a) && isObject(b)) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        if (keysA.length !== keysB.length) return false
        return keysA.every(key => isDeepEqual(a[key], b[key]))
    }
    return false
}

function useGroundNodeRects() {
    const root = useCanvasRoot()
    const selection = useSelection()

    const [rects, setRects] = useState<RectByGroundNodeId>(noRectByGroundNodeId)

    useEffect(() => {
        if (!root) {
            setRects(noRectByGroundNodeId)
            return
        }

        let active = true

        const getRects = async () => {
            let groundNodes: CanvasNode[]

            if (selection.length > 1) {
                groundNodes = []

                for (const node of selection) {
                    const parent = await node.getParent()
                    if (!parent) continue
                    if (!active) return
                    if (isWebPageNode(parent) || isComponentNode(parent) || isVectorSetNode(parent)) {
                        groundNodes.push(node)
                    }
                }
            } else {
                groundNodes = await root.getChildren()
                if (!active) return
            }

            const result: RectByGroundNodeId = {}

            for (const groundNode of groundNodes) {
                const rect = await groundNode.getRect()
                if (!active) return
                result[groundNode.id] = rect
            }

            setRects(current => (isDeepEqual(current, result) ? current : result))
        }

        void getRects()

        return () => {
            active = false
        }
    }, [root, selection])

    return rects
}

interface RectWithId extends Rect {
    id: string
}

function getSortedRects(
    rects: RectByGroundNodeId,
    layout: Layout,
    sorting: Sorting,
    columnCount: number,
    columnGap: number,
    rowGap: number
): RectWithId[] {
    const result: RectWithId[] = []

    for (const [id, rect] of Object.entries(rects)) {
        if (!rect) continue
        result.push({ id, ...rect })
    }

    if (layout !== "random") {
        switch (sorting) {
            case "position":
                result.sort((a, b) => {
                    if (a.y !== b.y) return a.y - b.y
                    return a.x - b.x
                })
                break
            case "width":
                result.sort((a, b) => b.width - a.width)
                break
            case "height":
                result.sort((a, b) => b.height - a.height)
                break
            case "area":
                result.sort((a, b) => {
                    const areaA = a.width * a.height
                    const areaB = b.width * b.height
                    return areaB - areaA
                })
                break
            default:
                assertNever(sorting)
        }
    }

    switch (layout) {
        case "horizontal": {
            let currentX = 0

            for (const rect of result) {
                rect.x = currentX
                rect.y = 0
                currentX += rect.width + columnGap
            }

            break
        }
        case "grid": {
            const maxSize = getMaxSize(result)
            result.forEach((rect, index) => {
                const columnIndex = index % columnCount
                const rowIndex = Math.floor(index / columnCount)
                rect.x = columnIndex * (maxSize.width + columnGap)
                rect.y = rowIndex * (maxSize.height + rowGap)
            })
            break
        }
        case "random":
            return getRandomizedRects(result, columnGap)
        default:
            assertNever(layout)
    }

    return result
}

function maxX(rect: Rect): number {
    return rect.x + rect.width
}

function maxY(rect: Rect): number {
    return rect.y + rect.height
}

function rectsIntersect(rectA: Rect, rectB: Rect): boolean {
    return !(rectB.x >= maxX(rectA) || maxX(rectB) <= rectA.x || rectB.y >= maxY(rectA) || maxY(rectB) <= rectA.y)
}

function increaseRectSize(rect: Rect, amount: number): Rect {
    return {
        x: rect.x - amount,
        y: rect.y - amount,
        width: rect.width + amount * 2,
        height: rect.height + amount * 2,
    }
}

function getRandomRect(rect: RectWithId, canvasWidth: number, canvasHeight: number): Rect {
    return {
        ...rect,
        x: Math.round(Math.random() * canvasWidth),
        y: Math.round(Math.random() * canvasHeight),
    }
}

function getRandomizeRectsForCanvas(
    rects: RectWithId[],
    gap: number,
    canvasWidth: number,
    canvasHeight: number
): RectWithId[] | null {
    const placedRects: RectWithId[] = []

    for (const rect of rects) {
        const maxTries = 100
        for (let i = 0; i < maxTries; i++) {
            const randomRect = getRandomRect(rect, canvasWidth, canvasHeight)
            const randomRectWithOffset = increaseRectSize(randomRect, gap)

            const isOverlapping = placedRects.some(rect => rectsIntersect(rect, randomRectWithOffset))
            if (isOverlapping) continue
            placedRects.push({ ...rect, ...randomRect })
            break
        }
    }

    if (rects.length !== placedRects.length) return null

    const boundingBox = getBoundingBox(placedRects)
    if (boundingBox.x === 0 && boundingBox.y === 0) return placedRects

    // Make sure all random rects are positioned relative to the canvas origin.
    for (const rect of placedRects) {
        rect.x -= boundingBox.x
        rect.y -= boundingBox.y
    }

    return placedRects
}

function getMaxSize(rects: Rect[]): Size {
    let maxWidth = 0
    let maxHeight = 0

    for (const rect of rects) {
        maxWidth = Math.max(maxWidth, rect.width)
        maxHeight = Math.max(maxHeight, rect.height)
    }

    return { width: maxWidth, height: maxHeight }
}

function getRandomizedRects(rects: RectWithId[], gap: number): RectWithId[] {
    if (rects.length === 0) return rects

    const maxSize = getMaxSize(rects)

    let canvasWidth = maxSize.width * 2
    let canvasHeight = maxSize.height * 2

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Intentional
    while (true) {
        const randomRects = getRandomizeRectsForCanvas(rects, gap, canvasWidth, canvasHeight)
        if (randomRects) return randomRects
        canvasWidth += maxSize.width
        canvasHeight += maxSize.height
    }
}

function getBoundingBox(rects: Rect[]): Rect {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const rect of rects) {
        minX = Math.min(minX, rect.x)
        minY = Math.min(minY, rect.y)
        maxX = Math.max(maxX, rect.x + rect.width)
        maxY = Math.max(maxY, rect.y + rect.height)
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    }
}

const allLayouts = ["horizontal", "grid", "random"] as const
const LayoutSchema = v.union(allLayouts.map(layout => v.literal(layout)))
type Layout = v.InferOutput<typeof LayoutSchema>

const allSortings = ["position", "width", "height", "area"] as const
const SortingSchema = v.union(allSortings.map(sorting => v.literal(sorting)))
type Sorting = v.InferOutput<typeof SortingSchema>

const ColumnCountSchema = v.pipe(v.number(), v.integer(), v.minValue(1))
const GapSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.multipleOf(10))

export function App() {
    const isAllowedToSetAttributes = useIsAllowedTo("setAttributes")
    const rects = useGroundNodeRects()

    const isEnabled = Object.keys(rects).length > 1

    const [transitionEnabled, setTransitionEnabled] = useState(false)

    const [layout, setLayout] = useLocaleStorageState("layout", "horizontal", LayoutSchema)
    const [sorting, setSorting] = useLocaleStorageState("sorting", "position", SortingSchema)
    const [columnCount, setColumnCount] = useLocaleStorageState("columnCount", 3, ColumnCountSchema)
    const [columnGap, setColumnGap] = useLocaleStorageState("columnGap", 100, GapSchema)
    const [rowGap, setRowGap] = useLocaleStorageState("rowGap", 100, GapSchema)

    const previewElement = useRef<HTMLDivElement | null>(null)
    const previewSize = useElementSize({
        ref: previewElement,
        deps: [layout],
        onChange: () => {
            setTransitionEnabled(false)
        },
    })

    const [randomKey, randomize] = useReducer((state: number) => state + 1, 0)

    const sortedRects = useMemo(
        () => getSortedRects(rects, layout, sorting, columnCount, columnGap, rowGap),
        [rects, layout, sorting, columnCount, columnGap, rowGap, randomKey]
    )
    const boundingBox = getBoundingBox(sortedRects)
    const [previewScale, previewOffset] = getPreviewScaleAndOffset(boundingBox, previewSize)

    const scaleValue = (value: number) => {
        return value * (value / previewScale)
    }

    return (
        <main>
            <div
                style={{
                    position: "relative",
                    flexGrow: 1,
                    width: "100%",
                    borderRadius: 10,
                    backgroundColor: "var(--framer-color-bg-tertiary)",
                    overflow: "hidden",
                    cursor: layout === "random" ? "pointer" : "default",
                }}
                title={layout === "random" ? "Randomize" : undefined}
                onClick={() => {
                    if (layout !== "random") return
                    setTransitionEnabled(true)
                    randomize()
                }}
            >
                {!isEnabled && (
                    <div
                        style={{
                            color: "var(--framer-color-text-tertiary)",
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            userSelect: "none",
                            zIndex: 1,
                        }}
                    >
                        Add Frames to Canvas
                    </div>
                )}
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))",
                    }}
                >
                    <div
                        ref={previewElement}
                        style={{
                            position: "absolute",
                            top: 20,
                            right: 20,
                            bottom: 20,
                            left: 20,
                            transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
                            transformOrigin: "0 0",
                            transition: transitionEnabled && layout === "random" ? "transform 0.2s" : "none",
                        }}
                    >
                        {isEnabled &&
                            sortedRects.map(rect => (
                                <div
                                    key={rect.id}
                                    className="preview-frame"
                                    style={{
                                        top: 0,
                                        left: 0,
                                        transform: `translate(${rect.x}px, ${rect.y}px)`,
                                        willChange: "transform",
                                        transition:
                                            transitionEnabled && layout === "random"
                                                ? "transform 0.2s, border-radius 0.2s"
                                                : "none",
                                        width: rect.width,
                                        height: rect.height,
                                        position: "absolute",
                                        borderRadius: scaleValue(1.5),
                                        boxShadow: `0px ${scaleValue(1.5)}px ${scaleValue(2.5)}px 0px rgba(0, 0, 0, 0.15)`,
                                    }}
                                />
                            ))}
                    </div>
                </div>
            </div>
            <Row title="Layout">
                <select
                    value={layout}
                    onChange={event => {
                        assert(v.is(LayoutSchema, event.target.value))
                        setLayout(event.target.value)
                        setTransitionEnabled(false)
                    }}
                >
                    {allLayouts.map(layout => (
                        <option key={layout} value={layout}>
                            {uppercaseFirstCharacter(layout)}
                        </option>
                    ))}
                </select>
            </Row>
            {layout !== "random" && (
                <Row title="Sort by">
                    <select
                        value={sorting}
                        onChange={event => {
                            assert(v.is(SortingSchema, event.target.value))
                            setSorting(event.target.value)
                            setTransitionEnabled(true)
                        }}
                    >
                        {allSortings.map(sorting => (
                            <option key={sorting} value={sorting}>
                                {uppercaseFirstCharacter(sorting)}
                            </option>
                        ))}
                    </select>
                </Row>
            )}
            {layout === "grid" && (
                <Row title="Columns">
                    <Stepper
                        value={columnCount}
                        min={1}
                        onChange={value => {
                            assert(v.is(ColumnCountSchema, value))
                            setColumnCount(value)
                        }}
                    />
                </Row>
            )}
            <Row title={layout === "random" ? "Min Gap" : layout === "grid" ? "Column Gap" : "Gap"}>
                <Stepper
                    value={columnGap}
                    min={0}
                    step={10}
                    onChange={value => {
                        assert(v.is(GapSchema, value))
                        setColumnGap(value)
                        setTransitionEnabled(true)
                    }}
                />
            </Row>
            {layout === "grid" && (
                <Row title="Row Gap">
                    <Stepper
                        value={rowGap}
                        min={0}
                        step={10}
                        onChange={value => {
                            assert(v.is(GapSchema, value))
                            setRowGap(value)
                            setTransitionEnabled(true)
                        }}
                    />
                </Row>
            )}
            <button
                disabled={!isAllowedToSetAttributes || !isEnabled}
                onClick={() => {
                    if (!isAllowedToSetAttributes || !isEnabled) return

                    const rawBoundingBox = getBoundingBox(Object.values(rects).filter(isRect))

                    const task = async () => {
                        for (const rect of sortedRects) {
                            const node = await framer.getNode(rect.id)
                            if (!node || !supportsPins(node)) continue

                            void node.setAttributes({
                                left: `${rect.x + rawBoundingBox.x}px`,
                                top: `${rect.y + rawBoundingBox.y}px`,
                            })
                        }
                    }

                    void task()
                }}
                title={isAllowedToSetAttributes ? undefined : "Insufficient permissions"}
            >
                {layout === "random" ? "Mess Up" : "Tidy Up"}
            </button>
        </main>
    )
}

function Row({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <div className="row">
            <label>{title}</label>
            {children}
        </div>
    )
}

function assert(condition: unknown, message?: string): asserts condition {
    if (!condition) throw new Error(message)
}

function assertNever(condition: never): never {
    throw Error(`Should never happen: ${String(condition)}`)
}

function uppercaseFirstCharacter(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !isArray(value)
}

function useLocaleStorageState<const TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    key: string,
    defaultValue: v.InferOutput<TSchema>,
    schema: TSchema
): [v.InferOutput<TSchema>, (value: v.InferOutput<TSchema>) => void] {
    const [value, setValue] = useState<v.InferOutput<TSchema>>(() => {
        try {
            const storedValue = localStorage.getItem(key)
            if (!storedValue) return defaultValue

            const parsed = JSON.parse(storedValue) as unknown
            return v.is(schema, parsed) ? parsed : defaultValue
        } catch {
            return defaultValue
        }
    })

    const setValueAndStore = (value: v.InferOutput<TSchema>) => {
        setValue(value)
        localStorage.setItem(key, JSON.stringify(value))
    }

    return [value, setValueAndStore]
}

function getPreviewScaleAndOffset(boundingBox: Rect, previewSize: Size): [number, Point] {
    const widthRatio = previewSize.width / Math.max(1, boundingBox.width)
    const heightRatio = previewSize.height / Math.max(1, boundingBox.height)
    const scale = Math.min(widthRatio, heightRatio)

    const offset: Point = { x: 0, y: 0 }

    if (widthRatio !== scale) {
        const maxX = scale * boundingBox.width
        const spaceRight = previewSize.width - maxX
        offset.x = spaceRight / 2
    } else if (heightRatio !== scale) {
        const maxY = scale * boundingBox.height
        const spaceBelow = previewSize.height - maxY
        offset.y = spaceBelow / 2
    }

    return [scale, offset]
}

function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
    const latest = useRef(callback)
    latest.current = callback
    return useCallback((...args: Args) => latest.current(...args), [])
}

function useElementSize({
    ref,
    deps,
    onChange,
}: {
    ref: React.RefObject<HTMLElement>
    deps: React.DependencyList
    onChange?: VoidFunction
}): Size {
    const [size, setSize] = useState<Size>({ width: 0, height: 0 })

    const stableOnChange = useStableCallback(() => onChange?.())

    useLayoutEffect(() => {
        function updateSizeWhenNeeded() {
            const element = ref.current
            if (!element) return

            const size: Size = {
                width: element.offsetWidth,
                height: element.offsetHeight,
            }
            setSize(size)
            stableOnChange()
        }

        updateSizeWhenNeeded()
        window.addEventListener("resize", updateSizeWhenNeeded)
        return () => {
            window.removeEventListener("resize", updateSizeWhenNeeded)
        }
    }, [ref, stableOnChange, ...deps])

    return size
}
