import { framer } from "framer-plugin"
import { useEffect } from "react"
import { getPluginUiOptions } from "../utils/plugin-ui"

export function ErrorScene() {
    useEffect(() => {
        void framer.showUI(getPluginUiOptions({ query: "error", hasResults: false, withMessage: true }))
    }, [])

    return (
        <div className="flex-1 flex justify-center items-center select-none py-1 px-2 mx-3 border-divider-light dark:border-divider-dark border-y">
            <div className="text-center text-tertiary-light dark:text-tertiary-dark text-xs space-y-4">
                The plugin crashed. Please close and reopen it. If it happens again,{" "}
                <a
                    href="https://www.framer.com/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0099FF]"
                >
                    contact support
                </a>
                .
            </div>
        </div>
    )
}
