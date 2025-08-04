import type { CustomCode } from "framer-plugin"
import { framer } from "framer-plugin"
import { useSyncExternalStore } from "react"
import "./App.css"

import scriptSource from "virtual:yield-gtm-calls"

void framer.showUI({
    position: "top right",
    width: 260,
    height: 135,
})

let currentCustomCode: CustomCode | null = null
const scriptToAdd = "<script>" + scriptSource + "</script>"

const subscribe = (callback: () => void) => {
    return framer.subscribeToCustomCode(customCode => {
        currentCustomCode = customCode
        callback()
    })
}
const getSnapshot = () => currentCustomCode

export function App() {
    const customCode = useSyncExternalStore(subscribe, getSnapshot)

    const scriptAdded = !!customCode?.headStart.html
    const scriptOutdated = scriptAdded && customCode.headStart.html !== scriptToAdd
    const toggleScript = () => {
        void framer.setCustomCode({
            html: scriptAdded && !scriptOutdated ? "" : scriptToAdd,
            location: "headStart",
        })
    }

    return (
        <main>
            <div className="framer-divider" />
            <center>
                Add a script to your custom HTML to improve site performance when using 3rd-party tracking scripts.{" "}
                <a href="TODO" target="_blank">
                    Learn more
                </a>
            </center>
            {customCode?.headStart.disabled && (
                <p>The script is disabled. Please go to Site Settings → General and enable it.</p>
            )}
            <button
                className={`framer-button-${scriptOutdated ? "primary" : scriptAdded ? "framer-button-danger" : "secondary"}`}
                onClick={toggleScript}
            >
                {scriptOutdated ? "Update Script" : scriptAdded ? "Remove Script" : "Add Script"}
            </button>
        </main>
    )
}
