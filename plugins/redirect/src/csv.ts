import { framer } from "framer-plugin"
import type { CreateRedirect, Redirect } from "framer-plugin"

export type CSVRecord = Record<string, string>
export type CSVHeader = "from" | "to" | "expanded"

export type ImportResultItem = CreateRedirect & {
    action: "add" | "conflict" | "onConflictUpdate" | "onConflictSkip"
}

export type ImportResult = {
    warnings: {
        missingFromCount: number
        missingToCount: number
        sameFromAndToCount: number
    }
    items: ImportResultItem[]
}

/**
 * Parses a string of CSV data.
 *
 * @param data CSV data, separated by comma or tab.
 * @param hasHeaders Optional. Whether the CSV has headers. If not specified, function will try to auto-detect.
 * @returns Array of parsed records
 */
export async function parseCSV(data: string, hasHeaders?: boolean): Promise<CSVRecord[]> {
    // Lazily import the parser
    const { parse } = await import("csv-parse/browser/esm/sync")

    let records: CSVRecord[] = []
    let error: unknown

    // Delimiters to try
    // ,  = pretty much the default
    // \t = more common when copy-pasting (e.g. Google Sheets)
    // ;  = what spreadsheet apps (e.g. Numbers) use when you're using a locale
    //      that already uses , for decimal separation
    // Check of , and \t will be combined as this will cover most cases, falls back to ;
    const delimiters = [",", "\t", ";"]

    // Default headers to use if none are present
    const defaultHeaders: CSVHeader[] = ["from", "to", "expanded"]

    for (const delimiter of delimiters) {
        try {
            // First, try to detect if there are headers if not explicitly specified
            let columnsOption: boolean | string[] = hasHeaders !== undefined ? hasHeaders : true

            // If headers are explicitly disabled, use default column names
            if (columnsOption === false) {
                columnsOption = defaultHeaders
            }

            const options = {
                columns: columnsOption,
                skipEmptyLines: true,
                skipRecordsWithEmptyValues: true,
            }

            const parsed = parse(data, { ...options, delimiter })

            // It can happen that parsing succeeds with the wrong delimiter. For example, a tab separated file could be parsed
            // successfully with comma separators. If that's the case, we can find it by checking two things:
            // 1. That the resulting records have more than one column
            // 2. That if there's only one column, it does not contain delimiters
            // If both of those conditions are met, we can assume there's a parsing error and should not import the records
            const firstItemKeys = isArray(parsed) && parsed[0] && isObject(parsed[0]) ? Object.keys(parsed[0]) : []
            if (firstItemKeys.length < 2) {
                const delimiterInKey = delimiters.some(del => firstItemKeys[0]?.includes(del))
                if (delimiterInKey) {
                    error = "Parsed with incorrect delimiter"
                    continue
                }
            }

            // If we auto-detected headers but the parsing resulted in records that don't have our expected keys,
            // try again with explicit headers
            if (hasHeaders === undefined && columnsOption === true) {
                const hasExpectedKeys =
                    firstItemKeys.length > 0 && (firstItemKeys.includes("from") || firstItemKeys.includes("to"))

                if (!hasExpectedKeys && parsed.length > 0) {
                    // Retry with explicit headers
                    const headersOption = defaultHeaders.slice(
                        0,
                        Math.min(defaultHeaders.length, isArray(parsed[0]) ? parsed[0].length : 0)
                    )

                    try {
                        const reparsed = parse(data, {
                            ...options,
                            delimiter,
                            columns: headersOption,
                            from: 1, // Skip header detection, start from first line
                        })

                        error = undefined
                        records = reparsed
                        break
                    } catch (innerErr) {
                        // If re-parsing fails, continue with the next delimiter
                        continue
                    }
                }
            }

            error = undefined
            records = parsed
            break
        } catch (err) {
            error = err
        }
    }

    if (error) {
        throw error
    }

    return records
}

const BOOLEAN_TRUTHY_VALUES = /1|y(?:es)?|true/iu

function getRecordValueForKey(key: "from" | "to", value: string | null): string | undefined
function getRecordValueForKey(key: "expanded", value: string | null): boolean | undefined
function getRecordValueForKey(key: CSVHeader, value: string | null): string | boolean | undefined {
    if (value === null) {
        return undefined
    }

    switch (key) {
        case "from":
        case "to":
            return value.trim()

        case "expanded":
            return BOOLEAN_TRUTHY_VALUES.test(value.trim())
    }
}

/** Importer for "records": string based values with named keys */
export async function processRecords(records: CSVRecord[]) {
    const existingRedirects = await framer.unstable_getRedirects()
    const existingRedirectsByFrom = new Map<string, Redirect>()
    for (const redirect of existingRedirects) {
        existingRedirectsByFrom.set(redirect.from, redirect)
    }

    const result: ImportResult = {
        warnings: {
            missingFromCount: 0,
            missingToCount: 0,
            sameFromAndToCount: 0,
        },
        items: [],
    }

    for (const record of records) {
        const from = getRecordValueForKey("from", record.from)
        if (!from) {
            result.warnings.missingFromCount++
            continue
        }

        const to = getRecordValueForKey("to", record.to)
        if (!to) {
            result.warnings.missingToCount++
            continue
        }

        if (from === to) {
            result.warnings.sameFromAndToCount++
            continue
        }

        const existingRedirect = existingRedirectsByFrom.get(from)
        const expanded = getRecordValueForKey("expanded", record.expanded)

        result.items.push({
            id: existingRedirect?.id,
            from,
            to,
            expandToAllLocales: expanded ?? true,
            action: existingRedirect ? "conflict" : "add",
        })
    }

    return result
}

export async function importCSV(result: ImportResult) {
    const totalItems = result.items.length
    const totalAdded = result.items.filter(item => item.action === "add").length
    const totalUpdated = result.items.filter(item => item.action === "onConflictUpdate").length
    const totalSkipped = result.items.filter(item => item.action === "onConflictSkip").length
    if (totalItems !== totalAdded + totalUpdated + totalSkipped) {
        throw new Error("Total items mismatch")
    }

    await framer.unstable_addRedirects(
        result.items
            .filter(item => item.action !== "onConflictSkip")
            .map(item =>
                item.action === "add"
                    ? {
                          from: item.from,
                          to: item.to,
                          expandToAllLocales: item.expandToAllLocales,
                      }
                    : {
                          id: item.id!,
                          from: item.from,
                          to: item.to,
                          expandToAllLocales: item.expandToAllLocales,
                      }
            )
    )

    const messages: string[] = []
    if (totalAdded > 0) {
        messages.push(`Added ${totalAdded} ${totalAdded === 1 ? "redirect" : "redirects"}`)
    }
    if (totalUpdated > 0) {
        messages.push(`Updated ${totalUpdated} ${totalUpdated === 1 ? "redirect" : "redirects"}`)
    }
    if (totalSkipped > 0) {
        messages.push(`Skipped ${totalSkipped} ${totalSkipped === 1 ? "redirect" : "redirects"}`)
    }

    if (result.warnings.missingFromCount > 0) {
        messages.push(
            `Skipped ${result.warnings.missingFromCount} ${
                result.warnings.missingFromCount === 1 ? "redirect" : "redirects"
            } because of missing "from" path`
        )
    }
    if (result.warnings.missingToCount > 0) {
        messages.push(
            `Skipped ${result.warnings.missingToCount} ${
                result.warnings.missingToCount === 1 ? "redirect" : "redirects"
            } because of missing "to" path`
        )
    }

    if (result.warnings.sameFromAndToCount > 0) {
        messages.push(
            `Skipped ${result.warnings.sameFromAndToCount} ${
                result.warnings.sameFromAndToCount === 1 ? "redirect" : "redirects"
            } because "from" and "to" paths are the same`
        )
    }

    const finalMessage = messages.join(". ")
    await framer.closePlugin(
        messages.length > 1 ? finalMessage + "." : finalMessage || `Successfully imported ${totalItems} redirects`
    )
}

export function convertRedirectsToCSV(redirects: readonly Redirect[]) {
    const headers: CSVHeader[] = ["from", "to", "expanded"]
    const csv = redirects.map(redirect =>
        headers
            .map(header => {
                switch (header) {
                    case "expanded":
                        return redirect.expandToAllLocales
                    default:
                        return redirect[header]
                }
            })
            .join(",")
    )

    return [headers.join(","), ...csv].join("\n")
}

function downloadFile(file: File) {
    const filename = file.name
    const fileURL = URL.createObjectURL(file)

    const link = document.createElement("a")
    link.href = fileURL
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(fileURL)
}

export function exportCSV(redirects: readonly Redirect[], filename: string) {
    const csv = convertRedirectsToCSV(redirects)
    const file = new File([csv], filename, { type: "text/csv" })
    downloadFile(file)
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value)
}
