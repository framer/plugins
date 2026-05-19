import cx from "classnames"
import { useMemo } from "react"

interface TabItem {
    label: string
    active: boolean
    select: () => void
}

interface Props {
    items: TabItem[]
}

export default function Tabs({ items }: Props) {
    const isPrerelease = useMemo(() => document.body.getAttribute("data-framer-styles") === "prerelease", [])
    const activeIndex = items.findIndex(item => item.active)

    return isPrerelease ? (
        <div className="prerelease-tabs">
            <div className="prerelease-tabs-container">
                {items.map((item, index) => (
                    <button key={index} className={cx("prerelease-tab", item.active && "active")} onClick={item.select}>
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    ) : (
        <div className="tabs">
            <div className="tabs-container">
                <div className="tab-bg-container">
                    {activeIndex !== -1 && (
                        <div
                            className="tab-bg"
                            style={{
                                width: `${100 / items.length}%`,
                                left: `${(100 / items.length) * activeIndex}%`,
                            }}
                        />
                    )}
                </div>

                {items.map((item, index) => (
                    <button key={index} className={cx("tab", item.active && "active")} onClick={item.select}>
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
