import type { CustomCode } from "framer-plugin"
import { framer } from "framer-plugin"
import { useLayoutEffect, useSyncExternalStore } from "react"
import "./App.css"

import scriptSource from "virtual:yield-gtm-calls"
import warning from "./warning.svg?url"

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
    const toggleScript = (update?: boolean) => {
        void framer.setCustomCode({
            html: scriptAdded && !update ? "" : scriptToAdd,
            location: "headStart",
        })
    }

    useLayoutEffect(() => {
        void framer.showUI({
            position: "top right",
            width: 260,
            height: scriptOutdated ? 197 : customCode?.headStart.disabled ? 147 : 135,
        })
    }, [customCode?.headStart.disabled, scriptOutdated])

    return (
        <main>
            <div className="framer-divider" />

            {!customCode?.headStart.disabled && (
                <p className="muted">
                    Add a script to your custom HTML to improve site performance when using 3rd-party tracking scripts.{" "}
                    <a href="TODO" target="_blank">
                        Learn more
                    </a>
                </p>
            )}

            {customCode?.headStart.disabled && (
                <div className="d-flex | align-center flex-column gap-10 justify-center">
                    <div className="d-flex | w-100 justify-center p-image">
                        <img src={warning} alt="Warning" />
                    </div>
                    <p className="muted">
                        The script is disabled. Please go to
                        <br /> Site Settings → General and enable it.
                    </p>
                </div>
            )}

            {scriptOutdated && (
                <>
                    <div className="framer-divider" />
                    <div className="d-flex | justify-space-between align-center w-100">
                        <p className="muted">New script version available</p>
                        <button
                            className="framer-button-primary framer-button-primary-inverted framer-button-small"
                            onClick={toggleScript.bind(null, true)}
                        >
                            Update
                        </button>
                    </div>
                    <div className="framer-divider" />
                </>
            )}

            <button className={`framer-button-secondary mt-5`} onClick={toggleScript.bind(null, false)}>
                {scriptAdded ? "Remove Script" : "Add Script"}
            </button>
        </main>
    )
}
