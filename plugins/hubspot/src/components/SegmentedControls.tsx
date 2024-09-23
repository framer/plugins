import { motion } from "framer-motion"
import cx from "classnames"

interface Option {
    value: string
    label: string
}

interface SegmentedControlProps {
    options: Option[]
    value: string
    name: string
    onValueChange: (value: string) => void
}

export const SegmentedControls = ({ options, value, onValueChange }: SegmentedControlProps) => {
    const selectedIndex = options.findIndex(option => option.value === value)
    const segmentWidth = 130 / options.length

    return (
        <div className="relative bg-tertiary w-[134px] h-[32px] p-0.5 rounded-lg flex items-center justify-center gap-1 font-semibold text-xs select-none">
            <motion.div
                style={{
                    width: `${segmentWidth}px`,
                }}
                className="absolute top-[2px] left-[2px] h-[28px] bg-white dark:bg-[#555555] rounded-md segment-control-shadow"
                initial={false}
                animate={{ x: `${selectedIndex * segmentWidth}px` }}
                transition={{ type: "spring", stiffness: 700, damping: 50 }}
            />
            {options.map(option => (
                <div
                    key={option.value}
                    onClick={() => onValueChange(option.value)}
                    className={cx("relative flex-grow text-center z-10", {
                        "text-tint dark:text-white cursor-default": value === option.value,
                        "text-tertiary hover:text-tertiary cursor-pointer": value !== option.value,
                    })}
                >
                    {option.label}
                </div>
            ))}
        </div>
    )
}
