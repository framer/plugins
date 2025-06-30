import { framer } from "framer-plugin"
import { useEffect } from "react"
import FileDiff from "./FileDiff"
import { cn } from "./utils"

function VersionsSidebar({ className }: { className?: string }) {
    return (
        <aside className={cn("bg-bg-secondary flex flex-col items-start px-5 py-3", className)}>
            <div className="font-bold text-lg mb-4">Versions</div>
            <div className="font-semibold text-text-base mb-2">12m ago</div>
            <div className="text-gray-400 mb-2">•</div>
            <div className="text-text-secondary">Johannes Gerber</div>
        </aside>
    )
}

// Example file contents
const oldContent = `function SampleComponent({
 name: string,
 color: string,
}) {
    return (
        <div style={{
        backgroundColor: color,
        }}>
            <h1>{name}</h1>
        </div>
    )
}

addPropertyControls(SampleComponent, {
    name: {
        type: ControlType.String,
        title: "Name",
        defaultValue: "Unicorn",
    }
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#000000",
    }
})

export default TiltCard
`

const newContent = `function SampleComponent({
 name: string,
 color: string,
}) {
    return (
        <div style={{
        backgroundColor: color,
        }}>
            <h2>{name}</h2>
        </div>
    )
}

addPropertyControls(SampleComponent, {
    name: {
        type: ControlType.String,
        title: "Name",
        defaultValue: "Magic Unicorn",
    }
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#000000",
    }
})

const awesome = true

export default TiltCard
`

export default function App() {
    useEffect(() => {
        framer.showUI({
            width: 760,
            height: 480,
            minWidth: 600,
            minHeight: 360,
            maxWidth: 1200,
            maxHeight: 800,
            resizable: true,
            position: "bottom right",
        })
    }, [])

    return (
        <div
            className={cn(
                "grid grid-cols-[var(--width-versions)_1fr] grid-rows-[1fr_auto] h-screen bg-bg-base text-text-base"
            )}
        >
            <VersionsSidebar className="row-span-2" />
            <div className="bg-bg-secondary overflow-hidden m-5">
                <FileDiff original={oldContent} revised={newContent} />
            </div>
            <button className="m-5 px-6 py-2 rounded bg-tint text-white font-semibold hover:bg-tint-dark transition">
                Restore
            </button>
        </div>
    )
}
