import { framer, type Redirect, type RedirectInput } from "framer-plugin"
import Papa from "papaparse"

export interface ParsedRedirects {
    from: string
    to: string
    expandToAllLocales: boolean
}

export function parseCSV(csv: string): ParsedRedirects[] {
    const parseResult = Papa.parse<string[]>(csv, { skipEmptyLines: true })
    const rows = parseResult.data
    if (rows.length === 0) return []

    const firstRow = rows[0]
    const hasHeaders = firstRow[0] === "from" && firstRow[1] === "to"

    if (firstRow.length > 3 || firstRow.length < 2) {
        throw new Error("CSV had invalid fields. Expected to,from,expandToAllLocales.")
    }

    const dataRows = hasHeaders ? rows.slice(1) : rows

    return dataRows.map(row => {
        return {
            from: row[0],
            to: row[1],
            expandToAllLocales: row.length > 2 ? row[2] === "true" : true,
        }
    })
}

export function countAndRemoveMissingRedirects(redirects: ParsedRedirects[]): ParsedRedirects[] {
    return redirects.filter(redirect => redirect.to !== "")
}

export async function normalizeRedirectInputs(redirects: ParsedRedirects[]): Promise<RedirectInput[]> {
    const existingRedirects = await framer.alpha_getRedirects()
    const existingRedirectsByFrom = new Map<string, Redirect>()

    for (const redirect of existingRedirects) {
        if (redirect.to) {
            existingRedirectsByFrom.set(redirect.from, redirect)
        }
    }

    const redirectInputs: RedirectInput[] = redirects
        .filter(redirect => redirect.to !== "")
        .map(redirect => {
            const existingRedirect = existingRedirectsByFrom.get(redirect.from)

            return {
                id: existingRedirect?.id,
                ...redirect,
            }
        })

    return redirectInputs
}

export function generateCsv(redirects: readonly Redirect[]): string {
    const redirectOutputs = redirects.map(redirect => ({
        from: redirect.from,
        to: redirect.to,
        expandToAllLocales: redirect.expandToAllLocales,
    }))

    return Papa.unparse(redirectOutputs, { columns: ["from", "to", "expandToAllLocales"] })
}
