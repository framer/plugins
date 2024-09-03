import { useRef } from "react"

export function ColorInput({
    value,
    onChange,
    erasable = false,
}: {
    value: string | boolean
    onChange?: (value: string | boolean) => void
    erasable?: boolean
}) {
    const inputRef = useRef<HTMLInputElement>(null)

    return (
        <div className="color-input" onClick={() => inputRef.current?.click()}>
            <input
                ref={inputRef}
                type="color"
                value={value as string}
                onChange={e => {
                    const value = e.target.value
                    onChange?.(value)
                }}
            />
            {value ? <span>{value}</span> : <span className="placeholder">Add...</span>}
            {value && erasable && (
                <div
                    className="erase"
                    onClick={e => {
                        e.stopPropagation()
                        onChange?.(false)
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">
                        <path
                            d="M 1.5 6.5 L 6.5 1.5"
                            fill="transparent"
                            stroke-width="1.5"
                            stroke="currentColor"
                            stroke-linecap="round"
                        ></path>
                        <path
                            d="M 6.5 6.5 L 1.5 1.5"
                            fill="transparent"
                            stroke-width="1.5"
                            stroke="currentColor"
                            stroke-linecap="round"
                        ></path>
                    </svg>
                </div>
            )}
        </div>
    )
}
