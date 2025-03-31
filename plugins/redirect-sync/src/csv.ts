import { framer, type Redirect, type RedirectInput } from "framer-plugin"
import Papa from "papaparse"

export interface ParsedRedirects {
    from: string
    to: string
    expandToAllLocales: boolean
}

export function parseCSV(csv: string): ParsedRedirects[] {
    const result = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
    })

    const parsedRedirects: ParsedRedirects[] = result.data.map(row => {
        if (
            !row ||
            !(typeof row === "object") ||
            !("from" in row) ||
            !("to" in row) ||
            !("expandToAllLocales" in row)
        ) {
            throw new Error("CSV had invalid fields. Expected to,from,expandToAllLocales.")
        }

        const { from, to, expandToAllLocales } = row

        if (
            typeof from !== "string" ||
            typeof to !== "string" ||
            (expandToAllLocales !== "true" && expandToAllLocales !== "false")
        ) {
            throw new Error("Invalid values for fields")
        }

        return {
            from,
            to,
            expandToAllLocales: expandToAllLocales === "true",
        }
    })

    return parsedRedirects
}

export async function normalizeRedirectInputs(redirects: ParsedRedirects[]): Promise<RedirectInput[]> {
    const existingRedirects = await framer.unstable_getRedirects()
    const existingRedirectsByFrom = new Map<string, Redirect>()

    for (const redirect of existingRedirects) {
        if (redirect.to) {
            existingRedirectsByFrom.set(redirect.from, redirect)
        }
    }

    const redirectInputs: RedirectInput[] = redirects.map(redirect => {
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
