import "./Tabs.css"

interface TabItem {
    label: string
    active: boolean
    select: () => void
}

interface Props {
    items: TabItem[]
}

export default function Tabs({ items }: Props) {
    return (
        <div className="tabs">
            {items.map((item, index) => (
                <button key={index} className={`tab ${item.active ? "active" : ""}`} onClick={item.select}>
                    {item.label}
                </button>
            ))}
        </div>
    )
}
