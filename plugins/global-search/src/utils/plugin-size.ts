/**
 * Returns the size of the plugin based on the query and whether there are results, in pixels.
 */
export function getPluginSize(query: string, hasResults: boolean) {
    if (query && hasResults) {
        return 320
    } else if (query && !hasResults) {
        return 140
    } else {
        return 50
    }
}
