import type { UIOptions } from "framer-plugin"

/**
 * Returns the size of the plugin based on the query and whether there are results, in pixels.
 */
export function getPluginUiOptions({
    query,
    hasResults,
}: {
    query: string | undefined
    hasResults: boolean
}): UIOptions {
    const uiOptions: UIOptions = {
        height: 50,
        width: 260,
        resizable: false,
    }

    if (query && hasResults) {
        uiOptions.height = 320
        uiOptions.resizable = "height"
    } else if (query && !hasResults) {
        uiOptions.height = 140
    } else {
        uiOptions.height = 50
    }

    return uiOptions
}
