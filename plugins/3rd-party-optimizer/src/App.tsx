import type { CustomCode } from "framer-plugin"
import { framer } from "framer-plugin"
import { useLayoutEffect, useRef, useSyncExternalStore } from "react"
import "./App.css"

let currentCustomCode: CustomCode | null = null

const subscribe = (callback: () => void) => {
    return framer.subscribeToCustomCode(customCode => {
        currentCustomCode = customCode
        callback()
    })
}
const getSnapshot = () => currentCustomCode

export function App() {
    const customCode = useSyncExternalStore(subscribe, getSnapshot)
    const mainRef = useRef<HTMLElement>(null)

    // subscribeToCustomCode only reports snippets this plugin installed.
    const snippetInstalled = !!customCode?.headStart.html

    const removeSnippet = () => {
        void framer.setCustomCode({
            html: null,
            location: "headStart",
        })
    }

    useLayoutEffect(
        function sizePluginToContent() {
            const height = mainRef.current?.offsetHeight
            if (!height) return

            void framer.showUI({
                position: "top right",
                width: 260,
                height,
            })
        },
        [snippetInstalled]
    )

    return (
        <main ref={mainRef} className="flex flex-col gap-[15px] | w-full | p-[15px] pt-0">
            <div className="framer-divider" />

            <p>
                This plugin has been replaced by “Optimize Third-Party Scripts”
                <br />
                in Settings → Performance.
            </p>

            {snippetInstalled && (
                <button className="framer-button-secondary" onClick={removeSnippet}>
                    Remove Script
                </button>
            )}
        </main>
    )
}
