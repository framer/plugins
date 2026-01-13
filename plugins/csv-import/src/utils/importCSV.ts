import { type Collection, framer } from "framer-plugin"

import { assert } from "./assert"
import type { ImportPayload } from "./prepareImportPayload"

/** Helper to show a summary of items, truncating after `max` */
function summary(items: string[], max: number) {
    const summaryFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" })

    if (items.length === 0) {
        return "none"
    }
    // Go one past the max, because we'll add a sentinel anyway
    if (items.length > max + 1) {
        items = items.slice(0, max).concat([`${items.length - max} more`])
    }
    return summaryFormatter.format(items)
}

export async function importCSV(collection: Collection, result: ImportPayload) {
    const totalItems = result.items.length
    const totalAdded = result.items.filter(item => item.action === "add").length
    const totalUpdated = result.items.filter(item => item.action === "onConflictUpdate").length
    const totalSkipped = result.items.filter(item => item.action === "onConflictSkip").length
    if (totalItems !== totalAdded + totalUpdated + totalSkipped) {
        throw new Error("Total items mismatch")
    }

    await collection.addItems(
        result.items
            .filter(item => item.action !== "onConflictSkip")
            .map(item => {
                if (item.action === "add") {
                    assert(item.slug !== undefined, "Item requires a slug")
                    return {
                        slug: item.slug,
                        fieldData: item.fieldData,
                        draft: item.draft,
                    }
                }

                assert(item.id !== undefined, "Item requires an id")
                return {
                    id: item.id,
                    fieldData: item.fieldData,
                    draft: item.draft,
                }
            })
    )

    const messages: string[] = []
    if (totalAdded > 0) {
        messages.push(`Added ${totalAdded} ${totalAdded === 1 ? "item" : "items"}`)
    }
    if (totalUpdated > 0) {
        messages.push(`Updated ${totalUpdated} ${totalUpdated === 1 ? "item" : "items"}`)
    }
    if (totalSkipped > 0) {
        messages.push(`Skipped ${totalSkipped} ${totalSkipped === 1 ? "item" : "items"}`)
    }

    if (result.warnings.missingSlugCount > 0) {
        messages.push(
            `Skipped ${result.warnings.missingSlugCount} ${
                result.warnings.missingSlugCount === 1 ? "item" : "items"
            } because of missing slug field`
        )
    }
    if (result.warnings.doubleSlugCount > 0) {
        messages.push(
            `Skipped ${result.warnings.doubleSlugCount} ${
                result.warnings.doubleSlugCount === 1 ? "item" : "items"
            } because of duplicate slugs in the CSV`
        )
    }

    const { skippedValueCount, skippedValueKeys } = result.warnings
    if (skippedValueCount > 0) {
        messages.push(
            `Skipped ${skippedValueCount} ${skippedValueCount === 1 ? "value" : "values"} for ${
                skippedValueKeys.size
            } ${skippedValueKeys.size === 1 ? "field" : "fields"} (${summary([...skippedValueKeys], 3)})`
        )
    }

    const finalMessage = messages.join(". ")
    framer.closePlugin(messages.length > 1 ? finalMessage + "." : finalMessage || "Successfully imported Collection")
}
