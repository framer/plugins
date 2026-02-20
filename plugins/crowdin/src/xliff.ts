import { framer, type Locale, type LocalizationData, type LocalizationGroup } from "framer-plugin"
import * as v from "valibot"
import { CreateFileResponseSchema, FileResponseSchema, LanguagesResponseSchema, ProjectsSchema } from "./api-types"

const API_URL = "https://api.crowdin.com/api/v2"
const IS_LOCALHOST = window.location.hostname === "localhost"

// -------------------- Types --------------------

interface StorageResponse {
    data: { id: number; fileName?: string }
}

export function parseXliff(xliffText: string, locales: readonly Locale[]): { xliff: Document; targetLocale: Locale } {
    const parser = new DOMParser()
    const xliff = parser.parseFromString(xliffText, "text/xml")

    const xliffElement = xliff.querySelector("file")
    if (!xliffElement) throw new Error("No xliff element found in XLIFF")

    const targetLanguage = xliffElement.getAttribute("target-language")
    if (!targetLanguage) throw new Error("No target language found in XLIFF")

    const targetLocale = locales.find(locale => locale.code === targetLanguage)
    if (!targetLocale) {
        throw new Error(`No locale found for language code: ${targetLanguage}`)
    }

    return { xliff, targetLocale }
}

export async function createValuesBySourceFromXliff(
    xliffDocument: Document,
    targetLocale: Locale
): Promise<LocalizationData["valuesBySource"]> {
    const valuesBySource: LocalizationData["valuesBySource"] = {}

    // Get all localization groups to find source IDs by text
    const groups = await framer.getLocalizationGroups()

    // Create a map of source text to source ID for quick lookup
    const sourceTextToId = new Map<string, string>()
    for (const group of groups) {
        for (const source of group.sources) {
            sourceTextToId.set(source.value, source.id)
        }
    }

    const units = xliffDocument.querySelectorAll("trans-unit")
    for (const unit of units) {
        const sourceElement = unit.querySelector("source")
        const target = unit.querySelector("target")
        if (!sourceElement || !target) continue

        const sourceText = sourceElement.textContent
        const targetValue = target.textContent

        // Ignore missing or empty values
        if (!sourceText || !targetValue) continue

        // Find the actual source ID by matching the source text
        const sourceId = sourceTextToId.get(sourceText)
        if (!sourceId) {
            if (IS_LOCALHOST) {
                console.warn(`No source ID found for text: "${sourceText}"`)
            }
            continue
        }

        valuesBySource[sourceId] = {
            [targetLocale.id]: {
                action: "set",
                value: targetValue,
                needsReview: false,
            },
        }
    }

    return valuesBySource
}

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function wrapIfHtml(text: string): string {
    // If text looks like HTML, wrap in CDATA
    if (/<[a-z][\s\S]*>/i.test(text)) {
        return `<![CDATA[${text}]]>`
    }
    return escapeXml(text)
}

export function generateSourceXliff(defaultLocale: Locale, groups: readonly LocalizationGroup[]): string {
    let units = ""
    for (const group of groups) {
        for (const source of group.sources) {
            const sourceValue = wrapIfHtml(source.value)
            units += `      <trans-unit id="${source.id}">
        <source>${sourceValue}</source>
        <note>${escapeXml(group.name)}</note>
      </trans-unit>\n`
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${defaultLocale.code}" datatype="plaintext" original="framer-export">
    <body>
${units}    </body>
  </file>
</xliff>`
}

export function generateXliff(
    defaultLocale: Locale,
    targetLocale: Locale,
    groups: readonly LocalizationGroup[]
): string {
    let units = ""

    for (const group of groups) {
        for (const source of group.sources) {
            const sourceValue = wrapIfHtml(source.value)
            const targetRaw = source.valueByLocale[targetLocale.id]?.value ?? ""
            const targetValue = wrapIfHtml(targetRaw)

            units += `      <trans-unit id="${source.id}">
        <source>${sourceValue}</source>
        <target state="${targetValue ? "translated" : "needs-translation"}">${targetValue}</target>
        <note>${escapeXml(group.name)}</note>
      </trans-unit>\n`
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${defaultLocale.code}" target-language="${targetLocale.code}" datatype="plaintext" original="framer-export">
    <body>
${units}    </body>
  </file>
</xliff>`
}

export async function uploadStorage(content: string, accessToken: string, fileName: string): Promise<Response> {
    return fetch(`${API_URL}/storages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Crowdin-API-FileName": fileName,
        },
        body: new Blob([content], { type: "application/x-xliff+xml" }),
    })
}
export async function ensureSourceFile(
    filename: string,
    projectId: number,
    accessToken: string,
    defaultLocale: Locale,
    groups: readonly LocalizationGroup[]
): Promise<number> {
    // Step 1: Check if file already exists in Crowdin
    const fileRes = await fetch(`${API_URL}/projects/${projectId}/files?limit=500`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    if (!fileRes.ok) {
        throw new Error(`Failed to fetch files: ${await fileRes.text()}`)
    }

    const fileData: unknown = await fileRes.json()
    const parsed = v.parse(FileResponseSchema, fileData)

    const existingFile = parsed.data.find(f => f.data.name === filename)
    if (existingFile) {
        if (IS_LOCALHOST) {
            console.log(`Source file already exists in Crowdin: ${filename} (id: ${existingFile.data.id})`)
        }
        return existingFile.data.id
    }

    // Step 2: Upload storage for new source file
    const xliffContent = generateSourceXliff(defaultLocale, groups)
    const storageRes = await uploadStorage(xliffContent, accessToken, filename)
    const storageData = (await storageRes.json()) as StorageResponse
    const storageId = storageData.data.id

    return await createFile(projectId, storageId, filename, accessToken)
}

async function checkAndCreateLanguage(projectId: number, language: Locale, accessToken: string): Promise<void> {
    const res = await fetch(`${API_URL}/languages?limit=500`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data: unknown = await res.json()
    const parsed = v.parse(LanguagesResponseSchema, data)
    const languages = parsed.data.map(l => l.data)

    const targetLanguage = languages.find(l => l.id === language.code)

    if (!targetLanguage) {
        if (IS_LOCALHOST) {
            console.log("No target language found")
        }
        throw new Error(
            `Language "${language.code}" is not available in Crowdin. Please check your locale's region and language code in Framer`
        )
    }
    await ensureLanguageInProject(projectId, language.code, accessToken)
}

export async function getProjectTargetLanguages(
    projectId: number,
    accessToken: string
): Promise<{ id: string; name: string }[]> {
    const res = await fetch(`${API_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
        throw new Error(`Failed to fetch project: ${res.statusText}`)
    }
    const raw: unknown = await res.json()
    const parsed = v.parse(ProjectsSchema, raw)
    if (!parsed.data) {
        throw new Error("Crowdin did not return a project object")
    }
    return parsed.data.targetLanguages.map(l => ({ id: l.id, name: l.name }))
}

export async function getProjectTargetLanguageIds(projectId: number, accessToken: string): Promise<string[]> {
    const targetLanguages = await getProjectTargetLanguages(projectId, accessToken)
    return targetLanguages.map(l => l.id)
}

export async function ensureLanguageInProject(
    projectId: number,
    newLanguageId: string,
    accessToken: string
): Promise<void> {
    const currentLanguages = await getProjectTargetLanguageIds(projectId, accessToken)

    if (currentLanguages.includes(newLanguageId)) {
        if (IS_LOCALHOST) {
            console.log(`Language "${newLanguageId}" already exists in project`)
        }
        return
    }

    const updatedLanguages = [...currentLanguages, newLanguageId]

    const patchRes = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify([
            {
                op: "replace",
                path: "/targetLanguageIds",
                value: updatedLanguages,
            },
        ]),
    })

    if (!patchRes.ok) {
        const err = await patchRes.text()
        throw new Error(`Failed to update languages: ${err}`)
    }
}

export async function updateTranslation(
    projectId: number,
    storageId: number,
    fileId: number,
    accessToken: string,
    activeLocale: Locale
): Promise<{ ok: boolean; errorMessage?: string }> {
    await checkAndCreateLanguage(projectId, activeLocale, accessToken)

    // Use the new translations imports API (the old POST .../translations/{languageId} is deprecated)
    const importRes = await fetch(`${API_URL}/projects/${projectId}/translations/imports`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            storageId,
            fileId,
            languageIds: [activeLocale.code],
            importEqSuggestions: true,
            autoApproveImported: true,
        }),
    })

    if (!importRes.ok) {
        const errText = await importRes.text()
        return { ok: false, errorMessage: errText }
    }

    const importData = (await importRes.json()) as { data?: { identifier?: string } }
    const importId = importData.data?.identifier
    if (!importId) {
        return { ok: false, errorMessage: "Import response missing identifier" }
    }

    // Poll until import completes (async operation)
    const maxAttempts = 60
    const pollIntervalMs = 1000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))

        const statusRes = await fetch(`${API_URL}/projects/${projectId}/translations/imports/${importId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!statusRes.ok) {
            return { ok: false, errorMessage: await statusRes.text() }
        }

        const statusData = (await statusRes.json()) as { data?: { status?: string } }
        const status = statusData.data?.status

        if (status === "finished") {
            return { ok: true }
        }
        if (status === "failed") {
            const reportRes = await fetch(`${API_URL}/projects/${projectId}/translations/imports/${importId}/report`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            const reportText = reportRes.ok ? await reportRes.text() : ""
            return { ok: false, errorMessage: `Import failed${reportText ? `: ${reportText}` : ""}` }
        }
        // status is "created" or "inProgress" – keep polling
    }

    return { ok: false, errorMessage: "Import timed out" }
}

/** Extract human-readable messages from Crowdin API error response shape: { errors: [{ error: { errors: [{ message }] } }] } */
function extractCrowdinErrorMessages(body: unknown): string | null {
    if (typeof body !== "object" || body === null || !("errors" in body)) return null
    const errors = (body as { errors: unknown[] }).errors
    if (!Array.isArray(errors)) return null
    const messages: string[] = []
    for (const item of errors) {
        if (typeof item !== "object" || item === null || !("error" in item)) continue
        const err = (item as { error: unknown }).error
        if (typeof err !== "object" || err === null || !("errors" in err)) continue
        const errList = (err as { errors: unknown[] }).errors
        if (!Array.isArray(errList)) continue
        for (const e of errList) {
            if (
                typeof e === "object" &&
                e !== null &&
                "message" in e &&
                typeof (e as { message: unknown }).message === "string"
            ) {
                messages.push((e as { message: string }).message)
            }
        }
    }
    return messages.length > 0 ? messages.join(" ") : null
}

export async function createFile(
    projectId: number,
    storageId: number,
    filename: string,
    accessToken: string
): Promise<number> {
    try {
        const fileRes = await fetch(`${API_URL}/projects/${projectId}/files`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                storageId,
                name: filename,
            }),
        })

        const fileData: unknown = await fileRes.json()

        if (!fileRes.ok) {
            const messages = extractCrowdinErrorMessages(fileData)
            throw new Error(messages ?? `Crowdin API error (${fileRes.status})`)
        }

        const parsed = v.parse(CreateFileResponseSchema, fileData)
        return parsed.data.id
    } catch (err) {
        console.error("Error in createFile:", err)
        throw err
    }
}
