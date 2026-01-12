import * as v from "valibot"

const CSVRecordSchema = v.record(v.string(), v.string())

export type CSVRecord = v.InferOutput<typeof CSVRecordSchema>

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value)
}

/**
 * Parses a string of CSV data. Does not do any type casting, because we want to
 * apply that based on the fields the data will go into, not the data itself.
 *
 * @param data CSV data, separated by comma or tab.
 * @returns Array of parsed records
 */
export async function parseCSV(data: string): Promise<CSVRecord[]> {
    // Lazily import the parser
    const { parse } = await import("csv-parse/browser/esm/sync")

    let records: CSVRecord[] = []
    let error

    // Delimiters to try
    // ,  = pretty much the default
    // \t = more common when copy-pasting (e.g. Google Sheets)
    // ;  = what spreadsheet apps (e.g. Numbers) use when you're using a locale
    //      that already uses , for decimal separation
    // Check of , and \t will be combined as this will cover most cases, falls back to ;
    const delimiters = [",", "\t", ";"]
    const options = { columns: true, skipEmptyLines: true, skipRecordsWithEmptyValues: true }

    for (const delimiter of delimiters) {
        try {
            const parsed = parse(data, { ...options, delimiter }) as unknown

            // It can happen that parsing succeeds with the wrong delimiter. For example, a tab separated file could be parsed
            // successfully with comma separators. If that's the case, we can find it by checking two things:
            // 1. That the resulting records have more than one column
            // 2. That if there's only one column, it does not contain delimiters
            // If both of those conditions are met, we can assume there's a parsing error and should not import the records
            const firstItemKeys = isArray(parsed) && parsed[0] && isObject(parsed[0]) ? Object.keys(parsed[0]) : []
            if (firstItemKeys.length < 2) {
                const delimiterInKey = delimiters.some(del => firstItemKeys[0]?.includes(del))
                if (delimiterInKey) {
                    error = new Error("Parsed with incorrect delimiter")
                    continue
                }
            }

            error = undefined
            records = v.parse(v.array(CSVRecordSchema), parsed)
            break
        } catch (innerError) {
            error = innerError instanceof Error ? innerError : new Error(String(innerError))
        }
    }

    if (error) {
        throw error
    }

    return records
}
