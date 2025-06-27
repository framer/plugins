import { framer } from "framer-plugin"
import { useEffect } from "react"

export default function App() {
    useEffect(() => {
        framer.showUI({
            width: 760,
            height: 480,
            minWidth: 600,
            minHeight: 360,
            maxWidth: Math.min(window.innerWidth, 1200),
            maxHeight: Math.min(window.innerHeight, 800),
            resizable: true,
            position: "bottom right",
        })
    }, [])

    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                width: "100vw",
                minWidth: 600,
                minHeight: 360,
                maxWidth: 1200,
                maxHeight: 800,
                overflow: "hidden",
            }}
        >
            <aside
                style={{
                    width: 280,
                    minWidth: 280,
                    maxWidth: 280,
                    background: "#f5f5f5",
                    borderRight: "1px solid #eee",
                    height: "100%",
                }}
            >
                List Panel (fixed width)
            </aside>
            <main
                style={{
                    flex: 1,
                    height: "100%",
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                Preview (responsive)
            </main>
        </div>
    )
}
