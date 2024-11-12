import { useState } from "react"
import cx from "classnames"

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
        <div
            className={cx(
                "flex bg-tertiary rounded-lg items-center pl-[10px] select-none",
                disabled && "opacity-50 cursor-default"
            )}
            onClick={toggle}
            role="button"
        >
            <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={toggle}
                className="checked:!bg-hs-orange focus:ring-1 focus:ring-hs-orange !border-none"
            />
            <input
                className="bg-transparent w-full shrink pointer-events-none select-none"
                type="text"
                disabled
                value={value}
            />
        </div>
    )
}
