import { type CanvasNode, framer } from "framer-plugin"
import { useEffect, useState } from "react"
import "./styles.css"

void framer.showUI({
    position: "top right",
    width: 240,
    height: 95,
})

function useSelection() {
    const [selection, setSelection] = useState<CanvasNode[]>([])

    useEffect(() => {
        return framer.subscribeToSelection(setSelection)
    }, [])

    return selection
}

export function App() {
    const selection = useSelection()
    const layer = selection.length === 1 ? "layer" : "layers"

    const handleAddSvg = () => {
        void framer.addSVG({
            svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="#999" d="M20 0v8h-8L4 0ZM4 8h8l8 8h-8v8l-8-8Z"/></svg>`,
            name: "Logo.svg",
        })
    }

    return (
        <main className="mx-4 space-y-2">
            <p>
                Welcome! Check out the{" "}
                <a href="https://framer.com/developers/plugins/introduction" target="_blank">
                    Docs
                </a>{" "}
                to start. You have {selection.length} {layer} selected.
            </p>
            <button className="framer-button-primary" onClick={handleAddSvg}>
                Insert Logo
            </button>
        </main>
    )
}
