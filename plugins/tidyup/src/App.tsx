import { framer, CanvasRootNode, supportsPins, CanvasNode, isWebPageNode, isComponentNode } from "framer-plugin"
import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, useReducer } from "react"
import "./App.css"
import { Stepper } from "./Stepper"
import { isNumber } from "./isNumber"

framer.showUI({
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
                    if (isWebPageNode(parent) || isComponentNode(parent)) {
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

        getRects()

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
        case "horizontal":
            let currentX = 0

            for (const rect of result) {
                rect.x = currentX
                rect.y = 0
                currentX += rect.width + columnGap
            }

            break
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

type Layout = "horizontal" | "grid" | "random"

type Sorting = "position" | "width" | "height" | "area"

export function App() {
    const rects = useGroundNodeRects()

    const isEnabled = Object.keys(rects).length > 1

    const [transitionEnabled, setTransitionEnabled] = useState(false)

    const [layout, setLayout] = useLocaleStorageState<Layout>("layout", "horizontal", isLayout)

    const [sorting, setSorting] = useLocaleStorageState<Sorting>("sorting", "position", isSorting)

    const [columnCount, setColumnCount] = useLocaleStorageState("columnCount", 3, isRoundedNumberWithMinimumOfOne)

    const [columnGap, setColumnGap] = useLocaleStorageState("columnGap", 100, isNumber)

    const [rowGap, setRowGap] = useLocaleStorageState("rowGap", 100, isNumber)

    const previewElement = useRef<HTMLDivElement | null>(null)
    const previewSize = useElementSize({
        ref: previewElement,
        deps: [layout],
        onChange: () => setTransitionEnabled(false),
    })

    const [randomKey, randomize] = useReducer((state: number) => state + 1, 0)

    const sortedRects = useMemo(
        () => getSortedRects(rects, layout, sorting, columnCount, columnGap, rowGap),
        [rects, layout, sorting, columnGap, columnCount, randomKey]
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
                        assert(isLayout(event.target.value))
                        setLayout(event.target.value)
                        setTransitionEnabled(false)
                    }}
                >
                    {Object.keys(allLayouts).map(layout => (
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
                            assert(isSorting(event.target.value))
                            setSorting(event.target.value)
                            setTransitionEnabled(true)
                        }}
                    >
                        {Object.keys(allSortings).map(sorting => (
                            <option key={sorting} value={sorting}>
                                {uppercaseFirstCharacter(sorting)}
                            </option>
                        ))}
                    </select>
                </Row>
            )}
            {layout === "grid" && (
                <Row title={"Columns"}>
                    <Stepper
                        value={columnCount}
                        min={1}
                        onChange={value => {
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
                        setColumnGap(value)
                        setTransitionEnabled(true)
                    }}
                />
            </Row>
            {layout === "grid" && (
                <Row title={"Row Gap"}>
                    <Stepper
                        value={rowGap}
                        min={0}
                        step={10}
                        onChange={value => {
                            setRowGap(value)
                            setTransitionEnabled(true)
                        }}
                    />
                </Row>
            )}
            <button
                disabled={!isEnabled}
                onClick={async () => {
                    if (!isEnabled) return

                    for (const rect of sortedRects) {
                        const node = await framer.getNode(rect.id)
                        if (!node || !supportsPins(node)) continue

                        const rawBoundingBox = getBoundingBox(Object.values(rects).filter(isRect))

                        node.setAttributes({
                            left: `${rect.x + rawBoundingBox.x}px`,
                            top: `${rect.y + rawBoundingBox.y}px`,
                        })
                    }
                }}
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
    throw Error(`Should never happen: ${condition}`)
}

function uppercaseFirstCharacter(value: string) {
    return value[0].toUpperCase() + value.slice(1)
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !isArray(value)
}

function isString(value: unknown): value is string {
    return typeof value === "string"
}

function isRoundedNumberWithMinimumOfOne(value: unknown): value is number {
    return isNumber(value) && value >= 1 && value === Math.round(value)
}

const allLayouts: Record<Layout, true> = {
    horizontal: true,
    grid: true,
    random: true,
}

function isLayout(value: unknown): value is Layout {
    return isString(value) && value in allLayouts
}

const allSortings: Record<Sorting, true> = {
    position: true,
    width: true,
    height: true,
    area: true,
}

function isSorting(value: unknown): value is Sorting {
    return isString(value) && value in allSortings
}

function useLocaleStorageState<T>(
    key: string,
    defaultValue: T,
    isValidValue: (value: unknown) => value is T
): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(() => {
        try {
            const storedValue = localStorage.getItem(key)
            console.log({ storedValue })
            if (!storedValue) return defaultValue

            const parsed = JSON.parse(storedValue)
            return isValidValue(parsed) ? parsed : defaultValue
        } catch {
            return defaultValue
        }
    })

    const setValueAndStore = (value: T) => {
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
