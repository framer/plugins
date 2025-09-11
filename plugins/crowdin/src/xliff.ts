import {
    framer,
    type Locale,
    type LocalizationData,
    type LocalizationGroup,
    type LocalizationSource,
    type LocalizedValueStatus,
} from "framer-plugin"
import * as v from "valibot"
import { ProjectsSchema, StoragesSchema } from "./api-types"

const API_URL = "https://api.crowdin.com/api/v2"

// -------------------- Types --------------------

interface StorageResponse {
    data: { id: number; fileName?: string }
}

interface FileResponse {
    data: { id: number; name?: string }
}

type XliffState = "initial" | "translated" | "reviewed" | "final"

// The two functions below have `undefined` in their return types as to future-proof against LocalizedValueStatus and
// XliffState unions being expanded in minor releases.

function statusToXliffState(status: LocalizedValueStatus): XliffState | undefined {
    switch (status) {
        case "new":
            return "initial"
        case "needsReview":
            return "translated"
        case "warning":
        case "done":
            return "final"
        default:
            status satisfies never
    }
}
function xliffStateToStatus(state: XliffState): LocalizedValueStatus | undefined {
    switch (state) {
        case "initial":
            return "new"
        case "translated":
            return "needsReview"
        case "reviewed":
        case "final":
            return "done"
        default:
            state satisfies never
    }
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

    return { xliff: xliff, targetLocale }
}

export function createValuesBySourceFromXliff(
    xliffDocument: Document,
    targetLocale: Locale
): LocalizationData["valuesBySource"] {
    const valuesBySource: LocalizationData["valuesBySource"] = {}

    const units = xliffDocument.querySelectorAll("trans-unit")
    for (const unit of units) {
        const id = unit.getAttribute("resname")
        const target = unit.querySelector("target")
        if (!id || !target) continue
        const targetValue = target.textContent
        const state = target.getAttribute("state") as XliffState | null
        const status = xliffStateToStatus(state ?? "final")
        const needsReview = status === "needsReview"

        // Ignore missing or empty values
        if (!targetValue) continue

        valuesBySource[id] = {
            [targetLocale.id]: {
                action: "set",
                value: targetValue,
                needsReview: needsReview ? needsReview : undefined,
            },
        }
    }

    return valuesBySource
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

export function generateGroup(localizationGroup: LocalizationGroup, targetLocale: Locale) {
    const units = localizationGroup.sources.map(source => generateUnit(source, targetLocale))

    return `        <group id="${localizationGroup.id}">
            <notes>
                <note category="type">${localizationGroup.type}</note>
                <note category="name">${escapeXml(localizationGroup.name)}</note>
                <note category="supportsExcludedStatus">${localizationGroup.supportsExcludedStatus.toString()}</note>
            </notes>
${units.join("\n")}
        </group>`
}

export function generateXliff(
    defaultLocale: Locale,
    targetLocale: Locale,
    localizationGroups: readonly LocalizationGroup[]
) {
    const groups = localizationGroups.map(localizationGroup => generateGroup(localizationGroup, targetLocale))

    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="${defaultLocale.code}" trgLang="${targetLocale.code}" source-language="${defaultLocale.code}">
    <file id="${targetLocale.id}">
${groups.join("\n")}
    </file>
</xliff>`
}

function generateUnit(source: LocalizationSource, targetLocale: Locale) {
    const localeData = source.valueByLocale[targetLocale.id]
    if (!localeData) {
        throw new Error(`No locale data found for locale: ${targetLocale.id}`)
    }

    const state = statusToXliffState(localeData.status)

    const sourceValue = escapeXml(source.value)
    const targetValue = escapeXml(localeData.value ?? "")

    const notes = [`<note category="type">${source.type}</note>`]

    if (localeData.status === "warning") {
        notes.push(`<note category="warning">${escapeXml(localeData.warning)}</note>`)
    }

    if (localeData.status !== "new") {
        notes.push(`<note category="lastEdited">${localeData.lastEdited}</note>`)
        notes.push(`<note category="readonly">${localeData.readonly.toString()}</note>`)
    }

    return `            <unit id="${source.id}">
                <notes>
                    ${notes.join("\n                    ")}
                </notes>
                <segment state="${state ?? ""}"${localeData.status === "warning" ? ` subState="framer:warning"` : ""}>
                    <source>${sourceValue}</source>
                    <target>${targetValue}</target>
                </segment>
            </unit>`
}

export async function uploadStorage(
    xliffContent: string,
    accessToken: string,
    activeLocale: Locale
): Promise<Response> {
    return await fetch(`${API_URL}/storages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Crowdin-API-FileName": `translations-${activeLocale.code}.xliff`,
        },
        body: xliffContent,
    })
}

export async function updateTranslation(
    projectId: number,
    storageId: string,
    fileId: number,
    accessToken: string,
    activeLocale: Locale
): Promise<Response> {
    return await fetch(`${API_URL}/projects/${projectId}/translations`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            storageId,
            fileId,
            languageId: activeLocale.code,
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
            console.error("Error parsing CrowdIn storages:", parsed.issues)
            throw new Error("Invalid storage response")
        }

        const existingStorage = parsed.output.data.find(item => item?.data?.fileName?.includes(fileName))

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
export async function getFileId(projectId: number, fileName: string, accessToken: string): Promise<number | undefined> {
    try {
        const filesRes = await fetch(`${API_URL}/projects/${projectId}/files`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const filesData = (await filesRes.json()) as unknown
        const parsed = v.safeParse(v.object({ data: v.array(ProjectsSchema) }), filesData)
        if (!parsed.success) {
            console.error("Error parsing CrowdIn files:", parsed.issues)
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
            return await createFile(projectId, fileName, accessToken)
        }
    } catch (err) {
        console.error("Error in getFileId:", err)
        throw err
    }
}

export async function createFile(projectId: number, fileName: string, accessToken: string): Promise<number> {
    try {
        const storageId = await getStorageId(fileName, accessToken)

        const fileRes = await fetch(`${API_URL}/projects/${projectId}/files`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: fileName,
                storageId,
                type: "json",
            }),
        })

        const fileData = (await fileRes.json()) as FileResponse
        return fileData.data.id
    } catch (err) {
        console.error("Error in createFile:", err)
        throw err
    }
}

export function downloadBlob(value: string, filename: string, type: string) {
    const blob = new Blob([value], { type })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = filename

    a.click()
    URL.revokeObjectURL(url)
}
