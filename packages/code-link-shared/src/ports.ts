import { shortProjectHash } from "./hash.js"

/**
 * Generate a deterministic port number from a project hash (full or short).
 * Port range: 3847-4096 (250 possible ports)
 * Must match between CLI and plugin.
 *
 * Internally normalizes to the short id so both full and short inputs yield the same port.
 */
export function getPortFromHash(projectHash: string): number {
    // Normalize to short hash so full hash and short hash yield same port
    const shortId = shortProjectHash(projectHash)

    let hash = 0
    for (let i = 0; i < shortId.length; i++) {
        const char = shortId.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32bit integer
    }
    const portOffset = Math.abs(hash) % 250
    return 3847 + portOffset
}
