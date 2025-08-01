import { useEffect, useRef } from "react"
import "./TextField.css"

interface Props {
    value: string
    setValue: (value: string) => void
    placeholder: string
    focused?: boolean
    disabled?: boolean
    leadingContent?: React.ReactNode
    onKeyDown: (event: React.KeyboardEvent) => void
}

export default function TextField({
    value,
    setValue,
    placeholder,
    focused,
    disabled = false,
    leadingContent,
    onKeyDown,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null)

    const focusInput = () => {
        inputRef.current?.focus()
    }

    useEffect(() => {
        if (focused) {
            inputRef.current?.focus()
        }
    }, [focused])

    return (
        <div className="text-field" onClick={focusInput} onKeyDown={focusInput} role="textbox" tabIndex={-1}>
            {leadingContent && <div className="leading-content">{leadingContent}</div>}

            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => {
                    setValue(e.target.value)
                }}
                ref={inputRef}
                disabled={disabled}
                onKeyDown={onKeyDown}
            />
        </div>
    )
}
