import classNames from "classnames"
import { useState } from "react"

interface Props {
    value: string
    darken: boolean
    checked: boolean
    onChange: () => void
}

export function CheckboxTextfield({ value, darken, checked: initialChecked, onChange }: Props) {
    const [checked, setChecked] = useState(initialChecked)

    const toggle = () => {
        setChecked(!checked)
        onChange()
    }

    return (
        <div
            className={classNames(
                "flex bg-tertiary rounded-lg items-center pl-[10px] select-none",
                darken && "opacity-50"
            )}
            onClick={toggle}
            role="button"
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={toggle}
                className="checked:!bg-sheets-green focus:ring-1 focus:ring-sheets-green"
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
