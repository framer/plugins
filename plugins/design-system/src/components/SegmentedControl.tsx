import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import "./segmented-control.css"

export function SegmentedControl(props: {
    value: string
    onChange: (value: string) => void
    items: { value: string; label: string }[]
}) {
    const { value, onChange, items } = props
    return (
        <div className="framer-control-row">
            <ToggleGroupPrimitive.Root
                type="single"
                value={value}
                onValueChange={(value: string) => {
                    if (value) {
                        onChange(value)
                    }
                }}
                className="segmented-control-container"
            >
                {items.map(item => (
                    <ToggleGroupPrimitive.Item
                        key={item.value}
                        value={item.value}
                        disabled={false}
                        asChild={false}
                        className="segmented-control-item"
                    >
                        <div className="segmented-control-divider" />
                        <p className="segmented-control-item-label">{item.label}</p>
                    </ToggleGroupPrimitive.Item>
                ))}
                <div className="segmented-control-indicator" />
            </ToggleGroupPrimitive.Root>
        </div>
    )
}
