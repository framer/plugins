import * as Slider from "@radix-ui/react-slider"
import { useEffect, useState } from "react"

function numDigitsAfterDecimal(x: number) {
    const afterDecimalStr = x.toString().split(".")[1] ?? ""
    return afterDecimalStr.length
}

export function NumberInput({
    value,
    onValueChange,
    min = -Infinity,
    max = Infinity,
    step = 1,
}: {
    value: number
    onValueChange?: (value: number) => void
    min?: number
    max?: number
    step?: number
}) {
    const [currentValue, setCurrentValue] = useState<string | number>(value)

    useEffect(() => {
        setCurrentValue(value)
    }, [value])

    function sanitize(value: number | string): number {
        value = Number(value)
        value = Math.min(Math.max(min, value), max)
        value = Math.floor(value / step) * step
        value = value.toFixed(numDigitsAfterDecimal(step))
        value = Number(value)
        return value
    }

    return (
        <>
            <input
                className="gui-input"
                type="number"
                min={min}
                max={max}
                step={step}
                value={currentValue}
                onChange={e => {
                    setCurrentValue(e.target.value)
                }}
                onFocus={e => {
                    e.target.select()
                }}
                onBlur={e => {
                    const value = sanitize(e.target.value)

                    onValueChange?.(value)
                    e.target.value = value.toString()
                }}
                onKeyDown={e => {
                    if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                        const value = sanitize(e.currentTarget.value)

                        onValueChange?.(value)
                        e.currentTarget.value = value.toString()
                    }
                }}
            />

            <Slider.Root
                className="SliderRoot"
                min={min}
                max={max}
                step={step}
                value={[value]}
                onValueChange={value => {
                    onValueChange?.(Number(value[0]))
                }}
            >
                <Slider.Track className="SliderTrack strokeWidth">
                    <Slider.Range className="SliderRange" />
                </Slider.Track>
                <Slider.Thumb className="SliderThumb" />
            </Slider.Root>
        </>
    )
}
