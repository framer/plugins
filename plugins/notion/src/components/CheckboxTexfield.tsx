import classNames from "classnames"
import { useState } from "react"

interface Props {
    value: string
    disabled: boolean
    checked: boolean
    onChange: () => void
}

export function CheckboxTextfield({ value, disabled, checked: initialChecked, onChange }: Props) {
    const [checked, setChecked] = useState(initialChecked)

    const toggle = () => {
        if (disabled) return

        setChecked(!checked)
        onChange()
    }

    return (
        <label
            className={classNames(
                "flex bg-tertiary rounded-[8px] items-center pl-[10px]",
                disabled && "opacity-50 cursor-default"
            )}
            role="button"
        >
            <input
                className="tailwind-hell-escape-hatch-checkbox"
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={toggle}
            />
            <input
                className="bg-transparent w-full shrink pointer-events-none select-none"
                type="text"
                disabled
                value={value}
            />
        </label>
    )
}
