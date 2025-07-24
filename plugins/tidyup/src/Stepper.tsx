import { isNumber } from "./isNumber"

import "./Stepper.css"

interface Props {
    value: number
    min: number
    step?: number
    onChange: (value: number) => void
}

function IconMinus() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
            <path
                d="M 0 4.75 C 0 4.336 0.336 4 0.75 4 L 8.75 4 C 9.164 4 9.5 4.336 9.5 4.75 C 9.5 5.164 9.164 5.5 8.75 5.5 L 0.75 5.5 C 0.336 5.5 0 5.164 0 4.75 Z"
                fill="rgb(153, 153, 153)"
            ></path>
        </svg>
    )
}

function IconPlus() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
            <path
                d="M 4 0.75 C 4 0.336 4.336 0 4.75 0 C 5.164 0 5.5 0.336 5.5 0.75 L 5.5 4 L 8.75 4 C 9.164 4 9.5 4.336 9.5 4.75 C 9.5 5.164 9.164 5.5 8.75 5.5 L 5.5 5.5 L 5.5 8.75 C 5.5 9.164 5.164 9.5 4.75 9.5 C 4.336 9.5 4 9.164 4 8.75 L 4 5.5 L 0.75 5.5 C 0.336 5.5 0 5.164 0 4.75 C 0 4.336 0.336 4 0.75 4 L 4 4 Z"
                fill="rgb(153, 153, 153)"
            ></path>
        </svg>
    )
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

export function Stepper({ value = 0, min = 0, step: stepAmount = 1, onChange }: Props) {
    const step = (direction: -1 | 1) => {
        onChange(clamp(value + stepAmount * direction, 0, Infinity))
    }

    return (
        <div className="stepper">
            <input
                className="stepper-input"
                type="number"
                value={value}
                min={min}
                step={stepAmount}
                onChange={event => {
                    const numberValue = event.currentTarget.valueAsNumber
                    const value = isNumber(numberValue) ? numberValue : 0

                    onChange(value)
                }}
            />

            <div className="stepper-controls">
                <button
                    className="stepper-button"
                    onClick={() => {
                        step(-1)
                    }}
                >
                    <IconMinus />
                </button>

                <div className="stepper-divider" />

                <button
                    className="stepper-button"
                    onClick={() => {
                        step(1)
                    }}
                >
                    <IconPlus />
                </button>
            </div>
        </div>
    )
}
