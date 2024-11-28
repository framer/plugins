import cx from "classnames"

interface Props {
    value: string
    disabled: boolean
    checked: boolean
    onChange: () => void
}

export function CheckboxTextfield({ value, disabled, checked, onChange }: Props) {
    const toggle = () => {
        if (disabled) return
        onChange()
    }

    return (
        <div
            className={cx("flex bg-tertiary rounded-lg items-center pl-[10px] select-none", {
                "opacity-50": disabled || !checked,
            })}
            onClick={toggle}
            role="button"
        >
            <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={toggle}
                onClick={e => e.stopPropagation()}
                className="checked:!bg-airtable-blue focus:ring-1 focus:ring-airtable-blue checked:border-none dark:!bg-[#777] !bg-[#CCC]"
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
