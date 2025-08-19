import cx from "classnames"

interface SegmentedControlItem {
    value: string
    label: string
}

interface Props {
    items: SegmentedControlItem[]
    value: string
    onChange: (value: string) => void
}

export default function SegmentedControl({ items, value, onChange }: Props) {
    const activeIndex = items.findIndex(item => item.value === value)

    return (
        <div className="segmented-control">
            <div className="segmented-control-bg-container">
                {activeIndex !== -1 && (
                    <div
                        className="segmented-control-bg"
                        style={{
                            width: `${100 / items.length}%`,
                            left: `${(100 / items.length) * activeIndex}%`,
                        }}
                    />
                )}
            </div>

            {items.map((item, index) => (
                <button
                    key={index}
                    className={cx("segmented-control-item", item.value === value && "active")}
                    onClick={() => {
                        onChange(item.value)
                    }}
                >
                    {item.label}
                </button>
            ))}
        </div>
    )
}
