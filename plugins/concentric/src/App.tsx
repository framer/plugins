import * as Slider from "@radix-ui/react-slider"
import { type CanvasNode, framer, supportsBorderRadius, useIsAllowedTo } from "framer-plugin"
import { useEffect, useRef, useState } from "react"

import "./App.css"

function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    event.target.select()
}

function calculateRadius(derivedFromOuterValue: boolean, value = 20, childRect: Rect) {
    const smallestValue = Math.max(childRect.x, childRect.y)

    if (derivedFromOuterValue) {
        return {
            outer: value,
            inner: value - smallestValue,
        }
    } else {
        return {
            outer: value + smallestValue,
            inner: value,
        }
    }
}

function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}

interface Rect {
    x: number
    y: number
    width: number
    height: number
}

export function App() {
    const [outerValue, setOuterValue] = useState(0)
    const [innerValue, setInnerValue] = useState(0)
    const [outerInputValue, setOuterInputValue] = useState("")
    const [innerInputValue, setInnerInputValue] = useState("")
    const selection = useSelection()

    // Main State
    const [state, setState] = useState<{
        parentNode: CanvasNode
        childNode: CanvasNode
        parentRect: Rect
        childRect: Rect
    } | null>(null)

    const isAllowedToSetAttributes = useIsAllowedTo("setAttributes")

    useEffect(() => {
        const parentNode = selection[0]

        if (!parentNode || selection.length !== 1) {
            setState(null)
            return
        }

        let active = true

        const task = async () => {
            const [children, parentRect] = await Promise.all([parentNode.getChildren(), parentNode.getRect()])

            if (!active) return
            if (children.length !== 1 || !parentRect) {
                setState(null)
                return
            }

            const childNode = children[0]
            if (!childNode) {
                setState(null)
                return
            }

            const childRect = await childNode.getRect()

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- https://github.com/typescript-eslint/typescript-eslint/issues/1459
            if (!active) return
            if (!childRect) {
                setState(null)
                return
            }

            setState({
                parentNode,
                childNode,
                parentRect,
                childRect,
            })

            if (!supportsBorderRadius(parentNode)) return
            const selectionParentRadius =
                parentNode.borderRadius !== null ? Number.parseInt(parentNode.borderRadius) : 0

            if (!supportsBorderRadius(childNode)) return
            const selectionChildRadius =
                childNode.borderRadius !== null
                    ? Number.parseInt(childNode.borderRadius) > 0
                        ? Number.parseInt(childNode.borderRadius)
                        : 0
                    : 0

            setOuterValue(selectionParentRadius)
            setOuterInputValue(selectionParentRadius.toString())

            setInnerValue(selectionChildRadius)
            setInnerInputValue(selectionChildRadius.toString())
        }

        void task()

        return () => {
            active = false
        }
    }, [selection])

    useEffect(() => {
        if (!isAllowedToSetAttributes) return

        if (state) {
            void framer.setAttributes(state.parentNode.id, {
                borderRadius: `${outerValue}px`,
            })
            void framer.setAttributes(state.childNode.id, {
                borderRadius: `${innerValue}px`,
            })
        }
    }, [outerValue, innerValue])

    function handleOuterSliderChange(value: number[]) {
        if (!state) return
        const { outer, inner } = calculateRadius(true, value[0], state.childRect)
        setOuterValue(outer)
        setInnerValue(inner)
        setOuterInputValue(`${outer}`)
        setInnerInputValue(`${inner > 0 ? inner : 0}`)
    }

    function handleInnerSliderChange(value: number[]) {
        if (!state) return
        const { outer, inner } = calculateRadius(false, value[0], state.childRect)
        setOuterValue(outer)
        setInnerValue(inner)
        setOuterInputValue(`${outer}`)
        setInnerInputValue(`${inner > 0 ? inner : 0}`)
    }

    const handleOuterInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value
        setOuterInputValue(newValue)
    }

    const handleInnerInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value
        setInnerInputValue(newValue)
    }

    const handleOuterKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            const newOuter = parseFloat(outerInputValue)
            if (!state) return
            const { outer, inner } = calculateRadius(true, newOuter, state.childRect)
            setOuterValue(outer)
            setInnerValue(inner)
            setOuterInputValue(`${outer}`)
            setInnerInputValue(`${inner > 0 ? inner : 0}`)
        }
    }

    const handleInnerKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            const newInner = parseFloat(innerInputValue)
            if (!state) return
            const { outer, inner } = calculateRadius(false, newInner, state.childRect)
            setOuterValue(outer)
            setInnerValue(inner)
            setOuterInputValue(`${outer}`)
            setInnerInputValue(`${inner > 0 ? inner : 0}`)
        }
    }

    const innerInputRef = useRef<HTMLInputElement>(null)
    const outerInputRef = useRef<HTMLInputElement>(null)

    function handlePointerDown() {
        if (innerInputRef.current) {
            innerInputRef.current.blur()
        }

        if (outerInputRef.current) {
            outerInputRef.current.blur()
        }
    }
    return (
        <main>
            <div className="flex">
                <div className={`row ${!state || !isAllowedToSetAttributes ? "disable" : ""}`}>
                    <p>Outer</p>
                    <input
                        type="number"
                        placeholder="0"
                        value={outerInputValue}
                        onChange={handleOuterInput}
                        onKeyDown={handleOuterKeyDown}
                        onFocus={handleFocus}
                        ref={outerInputRef}
                    />

                    <Slider.Root
                        className="SliderRoot"
                        defaultValue={[80]}
                        min={0}
                        max={200}
                        step={1}
                        onValueChange={handleOuterSliderChange}
                        onPointerDown={handlePointerDown}
                        value={[outerValue]}
                    >
                        <Slider.Track className="SliderTrack">
                            <Slider.Range className="SliderRange" />
                        </Slider.Track>
                        <Slider.Thumb className="SliderThumb" />
                    </Slider.Root>
                </div>
                <div className={`row ${!state || !isAllowedToSetAttributes ? "disable" : ""}`}>
                    <p>Inner</p>

                    <input
                        type="number"
                        placeholder="0"
                        value={innerInputValue}
                        onChange={handleInnerInput}
                        onKeyDown={handleInnerKeyDown}
                        onFocus={handleFocus}
                        ref={innerInputRef}
                    />
                    <Slider.Root
                        className="SliderRoot"
                        defaultValue={[80]}
                        min={0}
                        max={200}
                        step={1}
                        onValueChange={handleInnerSliderChange}
                        onPointerDown={handlePointerDown}
                        value={[innerValue]}
                    >
                        <Slider.Track className="SliderTrack">
                            <Slider.Range className="SliderRange" />
                        </Slider.Track>
                        <Slider.Thumb className="SliderThumb" />
                    </Slider.Root>
                </div>
            </div>
        </main>
    )
}
