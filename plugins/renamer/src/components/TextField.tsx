import { useEffect, useRef } from "react"

interface Props {
    value: string
    setValue: (value: string) => void
    placeholder: string
    focused?: boolean
    disabled?: boolean
    autoFocus?: boolean
    leadingContent?: React.ReactNode
}

export default function TextField({
    value,
    setValue,
    placeholder,
    focused,
    disabled = false,
    autoFocus = false,
    leadingContent,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (focused) {
            inputRef.current?.focus()
        }
    }, [focused])

    return (
        <label className="text-field" tabIndex={-1}>
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
                autoFocus={autoFocus}
            />
        </label>
    )
}
