import { framer } from "framer-plugin"
import { useEffect } from "react"
import { getPluginUiOptions } from "../utils/plugin-ui"

export function ErrorScene() {
    useEffect(() => {
        void framer.showUI(getPluginUiOptions({ query: "error", hasResults: false }))
    }, [])

    return (
        <div className="flex-1 flex justify-center items-center select-none py-1 px-4">
            <div className="text-center text-tertiary-light dark:text-tertiary-dark text-xs space-y-4">
                <p>
                    The plugin crashed.
                    <br />
                    Please close and reopen it.
                </p>
                <p>
                    If it happens again,{" "}
                    <a
                        href="https://www.framer.com/contact"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                    >
                        contact support
                    </a>
                    .
                </p>
            </div>
        </div>
    )
}
