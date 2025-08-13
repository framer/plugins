/**
 * Returns the size of the plugin based on the query and whether there are results, in pixels.
 */
export function getPluginSize({ query, hasResults }: { query: string | undefined; hasResults: boolean }): {
    height: number
    width: number
} {
    let height: number
    if (query && hasResults) {
        height = 320
    } else if (query && !hasResults) {
        height = 140
    } else {
        height = 50
    }
    return { height, width: 260 }
}
