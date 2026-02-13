import { framer, type UIOptions } from "framer-plugin"
import { useLayoutEffect } from "react"

// Automatically resize the plugin to match the height of the content.
// Use this in place of framer.showUI() inside a React component.
export function useDynamicPluginHeight(options: Partial<UIOptions> = {}) {
    useLayoutEffect(() => {
        const root = document.getElementById("root")
        if (!root) return

        const updateHeight = () => {
            const height = root.offsetHeight
            void framer.showUI({
                ...options,
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
        resizeObserver.observe(root)

        // Cleanup
        return () => {
            resizeObserver.disconnect()
        }
    }, [options])
}
