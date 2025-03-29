import cx from "classnames"

// Custom checkbox input with text field component
interface Props {
    value?: string
    disabled?: boolean
    checked?: boolean
    onChange?: () => void
}

export function CheckboxTextfield({ value, disabled, checked, onChange }: Props) {
    const toggle = () => {
        if (disabled) return
        onChange?.()
    }

    return (
        <div
            className={cx("flex bg-tertiary rounded-lg items-center pl-[10px] select-none", {
                "opacity-50": disabled || !checked,
                "pointer-events-none": disabled,
            })}
            onClick={toggle}
            role="button"
        >
            {/* Checkbox input */}
            <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={toggle}
                onClick={e => e.stopPropagation()}
                className="checked:!bg-greenhouse-green focus:ring-1 focus:ring-greenhouse-green checked:border-none dark:!bg-[#777] !bg-[#CCC]"
            />
            {/* Read-only text field */}
            <input
                className="bg-transparent w-full shrink pointer-events-none select-none"
                type="text"
                disabled
                value={value}
            />
        </div>
    )
}
