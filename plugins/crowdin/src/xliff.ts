import {
    framer,
    type Locale,
    type LocalizationData,
    type LocalizationGroup,
    type LocalizationSource,
    type LocalizedValueStatus,
} from "framer-plugin"
import * as v from "valibot"
import {
    CreateFileResponseSchema,
    FileResponseSchema,
    LanguagesResponseSchema,
    ProjectsSchema,
    StoragesSchema,
} from "./api-types"

const API_URL = "https://api.crowdin.com/api/v2"

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
            console.warn(`No source ID found for text: "${sourceText}"`)
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

// The two functions below have `undefined` in their return types as to future-proof against LocalizedValueStatus and
// XliffState unions being expanded in minor releases.

function statusToXliffState(status: LocalizedValueStatus): "new" | "needs-translation" | "translated" | "signed-off" {
    switch (status) {
        case "new":
            return "new"
        case "needsReview":
            return "needs-translation"
        case "done":
            return "translated"
        case "warning":
            // Crowdin doesn’t know “warning”, map it to translated but we can add subState note
            return "translated"
        default:
            return "new"
    }
}

export async function getTranslationFileContent(targetLocale: Locale): Promise<string> {
    try {
        const groups = await framer.getLocalizationGroups()
        if (groups.length === 0) {
            framer.notify("No localization data to export", { variant: "error" })
            return ""
        }
        const xliffUnits: string[] = []
        for (const group of groups) {
            for (const source of group.sources) {
                const sourceValue = source.value
                const targetValue = source.valueByLocale[targetLocale.id]?.value ?? source.value

                xliffUnits.push(`
  <trans-unit id="${source.id}">
    <source>${sourceValue}</source>
    <target state="needs-translation">${targetValue}</target>
  </trans-unit>`)
            }
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file id="${targetLocale.id}" source-language="${targetLocale.code}" target-language="${targetLocale.code}">
    <body>
${xliffUnits.join("\n")}
    </body>
  </file>
</xliff>`
    } catch (e) {
        console.log(e)
    }
    return ""
}

function escapeXml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function generateUnit(source: LocalizationSource, targetLocale: Locale, groupName?: string): string {
    const localeData = source.valueByLocale[targetLocale.id]
    if (!localeData) {
        throw new Error(`No locale data found for locale: ${targetLocale.id}`)
    }

    const state = statusToXliffState(localeData.status)
    const sourceValue = escapeXml(source.value)
    const targetValue = escapeXml(localeData.value ?? "")

    return `      <trans-unit id="${source.id}">
        <source>${sourceValue}</source>
        <target state="${state}">${targetValue}</target>
        ${groupName ? `<note>${escapeXml(groupName)}</note>` : ""}
      </trans-unit>`
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

export function generateGroup(localizationGroup: LocalizationGroup, targetLocale: Locale): string {
    const units = localizationGroup.sources.map(source => generateUnit(source, targetLocale))

    return `      <group id="${localizationGroup.id}">
        <note>${escapeXml(localizationGroup.name)}</note>
${units.join("\n")}
      </group>`
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
        console.log(`Source file already exists in Crowdin: ${filename} (id: ${existingFile.data.id})`)
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
        console.log("no target language found")
        throw new Error(
            `Language "${language.code}" is not available in Crowdin. Please check your locale's region and language code in Framer`
        )
    }
    await ensureLanguageInProject(projectId, language.code, accessToken)
}

export async function getProjectTargetLanguageIds(projectId: number, accessToken: string): Promise<string[]> {
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
    return parsed.data.targetLanguages.map(l => l.id)
}

export async function ensureLanguageInProject(
    projectId: number,
    newLanguageId: string,
    accessToken: string
): Promise<void> {
    const currentLanguages = await getProjectTargetLanguageIds(projectId, accessToken)

    if (currentLanguages.includes(newLanguageId)) {
        console.log(`Language ${newLanguageId} already exists in project`)
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
): Promise<Response> {
    await checkAndCreateLanguage(projectId, activeLocale, accessToken)
    return fetch(`${API_URL}/projects/${projectId}/translations/${activeLocale.code}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            storageId,
            fileId,
        }),
    })
}

// -------------------- Get or Create Storage --------------------
export async function getStorageId(fileName: string, accessToken: string): Promise<number> {
    try {
        const storageList = await fetch(`${API_URL}/storages`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        const storageData = (await storageList.json()) as unknown

        // Validate response with valibot
        const parsed = v.safeParse(v.object({ data: v.array(StoragesSchema) }), storageData)
        if (!parsed.success) {
            console.error("Error parsing Crowdin storages:", parsed.issues)
            throw new Error("Invalid storage response")
        }

        const existingStorage = parsed.output.data.find(item => item.data?.fileName?.includes(fileName))

        if (existingStorage) {
            return Number(existingStorage.data?.id ?? "")
        } else {
            return await createStorage(fileName, accessToken)
        }
    } catch (err) {
        console.error("Error in getStorageId:", err)
        throw err
    }
}

export async function createStorage(fileName: string, accessToken: string): Promise<number> {
    try {
        const groups = await framer.getLocalizationGroups()
        const stringsObject: Record<string, string> = {}

        for (const group of groups) {
            for (const src of group.sources) {
                if (src.id) stringsObject[src.id] = src.value
            }
        }

        const jsonString = JSON.stringify(stringsObject)
        const uint8Array = new TextEncoder().encode(jsonString)

        const storageRes = await fetch(`${API_URL}/storages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Crowdin-API-FileName": fileName,
            },
            body: uint8Array,
        })

        const storageData = (await storageRes.json()) as StorageResponse
        return storageData.data.id
    } catch (err) {
        console.error("Error in createStorage:", err)
        throw err
    }
}

// -------------------- Get or Create File --------------------
export async function getFileId(projectId: number, fileName: string, accessToken: string): Promise<number | Response> {
    try {
        const filesRes = await fetch(`${API_URL}/projects/${projectId}/files`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const filesData = (await filesRes.json()) as unknown
        const parsed = v.safeParse(v.object({ data: v.array(ProjectsSchema) }), filesData)
        if (!parsed.success) {
            console.error("Error parsing Crowdin files:", parsed.issues)
            throw new Error("Invalid file response")
        }

        const storageId = await getStorageId(fileName, accessToken)
        const existingFile = parsed.output.data.find(item => item.data?.name?.includes(fileName))
        const existingFileId = Number(existingFile?.data?.id ?? "")

        if (existingFileId) {
            await fetch(`${API_URL}/projects/${projectId}/files/${existingFileId}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ storageId }),
            })
            return existingFileId
        } else {
            return await createFile(projectId, storageId, fileName, accessToken)
        }
    } catch (err) {
        console.error("Error in getFileId:", err)
        throw err
    }
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
        const parsed = v.parse(CreateFileResponseSchema, fileData)
        return parsed.data.id
    } catch (err) {
        console.error("Error in createFile:", err)
        throw err
    }
}

export function downloadBlob(value: string, filename: string, type: string): void {
    const blob = new Blob([value], { type })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = filename

    a.click()
    URL.revokeObjectURL(url)
}
