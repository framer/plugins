import cx from "classnames"

interface Props {
    value: string
    darken: boolean
    checked: boolean
    onChange: (newChecked: boolean) => void
    disabled?: boolean
}

export function CheckboxTextfield({ value, darken, checked, onChange, disabled }: Props) {
    const toggle = () => {
        onChange(!checked)
    }

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.checked)
    }

    return (
        <div
            className={cx(
                "flex bg-tertiary rounded-lg items-center pl-[10px] select-none h-[30px] cursor-pointer",
                darken && "opacity-50"
            )}
            onClick={disabled ? undefined : toggle}
            role={disabled ? undefined : "button"}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={handleCheckboxChange}
                onClick={e => {
                    e.stopPropagation()
                }}
                disabled={disabled}
                className="cursor-pointer"
            />
            <span className="w-full pl-2 text-primary">{value}</span>
        </div>
    )
}
