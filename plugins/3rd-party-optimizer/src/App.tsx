import type { CustomCode } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { useLayoutEffect, useSyncExternalStore } from "react"
import "./App.css"

const PLUGIN_WIDTH = 260
const PLUGIN_WIDTH_WITH_ACTION = 280
// showUI height is the body. The title bar is outside it, so the body is shorter by this much.
const PLUGIN_TITLE_BAR_HEIGHT = 50

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
    const isAllowedToSetCustomCode = useIsAllowedTo("setCustomCode")

    // subscribeToCustomCode only reports snippets this plugin installed.
    const snippetInstalled = !!customCode?.headStart.html

    useLayoutEffect(
        function sizeSquarePopover() {
            const width = snippetInstalled ? PLUGIN_WIDTH_WITH_ACTION : PLUGIN_WIDTH

            void framer.showUI({
                position: "top right",
                width,
                height: width - PLUGIN_TITLE_BAR_HEIGHT,
            })
        },
        [snippetInstalled]
    )

    const removeSnippet = () => {
        void framer.setCustomCode({
            html: null,
            location: "headStart",
        })
    }

    return (
        <main className="flex flex-col | w-full h-full | p-[15px] pt-0 box-border">
            <div className="framer-divider" />

            <div className="flex flex-1 flex-col gap-[15px] justify-center items-center | w-full">
                <p>
                    This plugin has been replaced by “Optimize third-party scripts”
                    <br />
                    in Settings → Performance.
                </p>

                {snippetInstalled && (
                    <button
                        className="framer-button-secondary | w-auto p-3"
                        onClick={removeSnippet}
                        disabled={!isAllowedToSetCustomCode}
                        title={isAllowedToSetCustomCode ? undefined : "Insufficient permissions"}
                    >
                        Remove script
                    </button>
                )}
            </div>
        </main>
    )
}
