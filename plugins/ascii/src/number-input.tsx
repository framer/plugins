import * as Slider from "@radix-ui/react-slider"
import { useEffect, useState } from "react"

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
    const [currentValue, setCurrentValue] = useState(value)

    useEffect(() => {
        setCurrentValue(value)
    }, [value])

    function sanitize(value: number | string): number {
        value = Number(value)
        value = Math.min(Math.max(min, value), max)
        value = Math.floor(value / step) * step
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
                value={currentValue.toString()}
                onChange={e => {
                    setCurrentValue(Number(e.target.value))
                }}
                onBlur={e => {
                    const value = sanitize(e.target.value)

                    onValueChange?.(value)
                    e.target.value = value.toString()
                }}
                onKeyDown={e => {
                    if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                        const value = sanitize(e.target.value)

                        onValueChange?.(value)
                        e.target.value = value.toString()
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
