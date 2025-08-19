import type { UIOptions } from "framer-plugin"

/**
 * Returns the size of the plugin based on the query and whether there are results, in pixels.
 */
export function getPluginUiOptions({
    query,
    hasResults,
    areResultsFinal,
}: {
    query?: string
    hasResults?: boolean
    areResultsFinal?: boolean
}): UIOptions {
    const uiOptions: UIOptions = {
        height: 50,
        width: 260,
        resizable: false,
    }

    if (query && hasResults) {
        uiOptions.height = 320
        uiOptions.resizable = "height"
    } else if (query && !hasResults && areResultsFinal) {
        uiOptions.height = 140
    } else {
        uiOptions.height = 50
    }

    return uiOptions
}
