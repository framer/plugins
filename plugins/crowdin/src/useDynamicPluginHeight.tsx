import { framer, type UIOptions } from "framer-plugin"
import { useLayoutEffect } from "react"

// Automatically resize the plugin to match the height of the content.
// Use this in place of framer.showUI() inside a React component.
export function useDynamicPluginHeight(options: Partial<UIOptions> = {}) {
    useLayoutEffect(() => {
        const root = document.getElementById("root")
        if (!root) return

        const contentElement = root.firstElementChild
        if (!contentElement) return

        const updateHeight = () => {
            const height = contentElement.scrollHeight
            framer.showUI({
                ...options,
                resizable:
                    options.resizable === true ? "width" : options.resizable === "height" ? false : options.resizable,
                height: Math.max(options.minHeight ?? 0, Math.min(height, options.maxHeight ?? Infinity)),
            })
        }

        // Initial height update
        updateHeight()

        // Create ResizeObserver to watch for height changes
        const resizeObserver = new ResizeObserver(() => {
            updateHeight()
        })

        // Start observing the content element
        resizeObserver.observe(contentElement)

        // Cleanup
        return () => {
            resizeObserver.disconnect()
        }
    }, [options])
}
