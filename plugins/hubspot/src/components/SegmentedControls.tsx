import cx from "classnames"
import { motion } from "motion/react"

interface Option {
    value: string
    label: string
}

interface SegmentedControlProps {
    options: Option[]
    value: string
    name: string
    onValueChange: (value: string) => void
    disabled?: boolean
    title?: string
}

export const SegmentedControls = ({ options, value, onValueChange, disabled, title }: SegmentedControlProps) => {
    const selectedIndex = options.findIndex(option => option.value === value)
    const segmentWidth = 130 / options.length

    return (
        <div className="relative bg-tertiary w-[134px] h-[30px] p-0.5 rounded-lg flex items-center justify-center font-semibold text-xs select-none">
            <motion.div
                style={{
                    width: `${segmentWidth}px`,
                }}
                className="absolute top-[2px] left-[2px] h-[26px] bg-white dark:bg-[#474747] rounded-md segmented-control-shadow"
                initial={false}
                animate={{ x: `${selectedIndex * segmentWidth}px` }}
                transition={{ type: "spring", duration: 0.2, bounce: 0 }}
            />
            {options.map(option => (
                <div
                    key={option.value}
                    onClick={
                        disabled
                            ? undefined
                            : () => {
                                  onValueChange(option.value)
                              }
                    }
                    className={cx(
                        "relative flex-1 z-10 h-full flex items-center justify-center transition-colors duration-200",
                        value === option.value ? "text-tint dark:text-white" : "text-[#999]",
                        disabled ? "opacity-50 cursor-default" : "cursor-pointer"
                    )}
                    title={title}
                >
                    {option.label}
                </div>
            ))}
        </div>
    )
}
