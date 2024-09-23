import cx from "classnames"

interface Props {
    value: string
    darken: boolean
    checked: boolean
    onChange: (newChecked: boolean) => void
}

export function CheckboxTextfield({ value, darken, checked, onChange }: Props) {
    const toggle = () => {
        onChange(!checked)
    }

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.checked)
    }

    return (
        <div
            className={cx("flex bg-tertiary rounded-lg items-center pl-[10px] select-none", { "opacity-50": darken })}
            onClick={toggle}
            role="button"
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={handleCheckboxChange}
                onClick={e => e.stopPropagation()}
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
