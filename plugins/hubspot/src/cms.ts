import { type ManagedCollectionField, framer } from "framer-plugin"
import { useEffect } from "react"

export const MAX_CMS_ITEMS = 10_000
export const PLUGIN_LOG_SYNC_KEY = "hubspotLogSyncResult"
export const FIELD_DELIMITER = "rfa4Emr21pUgs0in"

export interface ItemResult {
    fieldName?: string
    message: string
}

export interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}

export interface SyncResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

export type FieldsById = Map<string, ManagedCollectionField>

const isLoggingEnabled = () => {
    return localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"
}

export function logSyncResult(result: SyncResult, collectionItems?: Record<string, unknown>[]) {
    if (!isLoggingEnabled()) return

    if (collectionItems) {
        console.table(collectionItems)
    }

    if (result.errors.length > 0) {
        console.log("Completed errors:")
        console.table(result.errors)
    }

    if (result.warnings.length > 0) {
        console.log("Completed warnings:")
        console.table(result.warnings)
    }

    console.log("Completed info:")
    console.table(result.info)
}

export const useLoggingToggle = () => {
    useEffect(() => {
        const isLoggingEnabled = () => localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"

        const toggle = () => {
            const newState = !isLoggingEnabled()
            localStorage.setItem(PLUGIN_LOG_SYNC_KEY, newState ? "true" : "false")
            framer.notify(`Logging ${newState ? "enabled" : "disabled"}`, { variant: "info" })
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "L") {
                e.preventDefault()
                toggle()
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [])
}

// Match everything except for letters, numbers and parentheses.
const nonSlugCharactersRegExp = /[^\p{Letter}\p{Number}()]+/gu
// Match leading/trailing dashes, for trimming purposes.
const trimSlugRegExp = /^-+|-+$/gu

/**
 * Takes a freeform string and removes all characters except letters, numbers,
 * and parentheses. Also makes it lower case, and separates words by dashes.
 * This makes the value URL safe.
 */
export function slugify(value: string): string {
    return value.toLowerCase().replace(nonSlugCharactersRegExp, "-").replace(trimSlugRegExp, "")
}

/**
 * Generates an 8-character unique ID from a text using the djb2 hash function.
 * Converts the 32-bit hash to an unsigned integer and then to a hex string.
 */
export function generateHash(text: string): string {
    let hash = 5381
    for (let i = 0, len = text.length; i < len; i++) {
        hash = (hash * 33) ^ text.charCodeAt(i)
    }
    // Convert to unsigned 32-bit integer
    const unsignedHash = hash >>> 0
    return unsignedHash.toString(16).padStart(8, "0")
}

/**
 * Creates a consistent hash from an array of field IDs
 */
export function createFieldSetHash(fieldIds: string[]): string {
    // Ensure consistent ordering
    const sortedIds = [...fieldIds].sort()
    return generateHash(sortedIds.join(FIELD_DELIMITER))
}

/**
 * Processes a field set to determine the complementary fields
 */
export function computeFieldSets(params: {
    currentFields: ManagedCollectionField[]
    allPossibleFieldIds: string[]
    storedHash: string
}) {
    const { currentFields, allPossibleFieldIds, storedHash } = params
    const currentFieldIds = currentFields.map(field => field.id)

    const includedFieldIds = currentFieldIds

    const excludedFieldIds = allPossibleFieldIds.filter(id => !currentFieldIds.includes(id))

    const currentHash = createFieldSetHash(includedFieldIds)

    return {
        includedFieldIds,
        excludedFieldIds,
        hasHashChanged: storedHash !== currentHash,
    }
}
