import type { CustomCode } from "framer-plugin"
import { framer } from "framer-plugin"
import { useLayoutEffect, useSyncExternalStore } from "react"
import "./App.css"

import scriptSource from "virtual:yield-gtm-calls"
import warning from "./warning.svg?url"

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

    const scriptAdded = !!customCode?.headStart.html
    const scriptOutdated = scriptAdded && customCode.headStart.html !== scriptSource
    const toggleScript = (update?: boolean) => {
        void framer.setCustomCode({
            html: scriptAdded && !update ? "" : scriptSource,
            location: "headStart",
        })
    }

    useLayoutEffect(() => {
        let height = 137
        if (customCode?.headStart.disabled) {
            height += 10
        }
        if (scriptOutdated) {
            height += 60
        }

        void framer.showUI({
            position: "top right",
            width: 260,
            height,
        })
    }, [customCode?.headStart.disabled, scriptOutdated])

    return (
        <main className="flex flex-col gap-[15px] | items-start | h-full | p-[15px] pt-0">
            <div className="framer-divider" />

            {!customCode?.headStart.disabled && (
                <p className="text-center">
                    Add a script to your custom HTML to improve site performance when using 3rd-party tracking scripts.{" "}
                    <a href="https://www.framer.com/marketplace/plugins/3rd-party-optimizer/" target="_blank">
                        Learn more
                    </a>
                </p>
            )}

            {customCode?.headStart.disabled && (
                <div className="flex flex-col gap-[10px] | content-center justify-center">
                    <div className="flex | justify-center | w-full | py-[4px]">
                        <img src={warning} alt="Warning" />
                    </div>
                    <p className="text-center">
                        The script is disabled. Please go to
                        <br /> Site Settings → General and enable it.
                    </p>
                </div>
            )}

            {scriptOutdated && (
                <>
                    <div className="framer-divider" />
                    <div className="flex | justify-between content-center | w-full">
                        <p className="text-center">New script version available</p>
                        <button
                            className="framer-button-primary bg-[var(--framer-color-tint-dimmed)] text-[var(--framer-color-tint)] hover:bg-[var(--framer-color-tint-dimmed)] focus:bg-[var(--framer-color-tint-dimmed)] | rounded-[6px] | text-[10px] font-500 | w-[46px] h-[20px]"
                            onClick={toggleScript.bind(null, true)}
                        >
                            Update
                        </button>
                    </div>
                    <div className="framer-divider" />
                </>
            )}

            <button
                className={`framer-button-secondary${scriptOutdated ? "" : " mt-[5px]"}`}
                onClick={toggleScript.bind(null, false)}
            >
                {scriptAdded ? "Remove Script" : "Add Script"}
            </button>
        </main>
    )
}
