import { framer, type Locale } from "framer-plugin"
import * as v from "valibot"
import { ProjectsSchema, StoragesSchema } from "./api-types"

const API_URL = "https://api.crowdin.com/api/v2"

// -------------------- Types --------------------
interface TranslationValue {
    action: string
    value: string
}

type ValuesBySource = Record<string, Record<string, TranslationValue>>

interface StorageResponse {
    data: { id: number; fileName?: string }
}

interface FileResponse {
    data: { id: number; name?: string }
}

// ----- XLIFF parsers -----
export function parseXliff12(xliffText: string, locales: readonly Locale[]) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xliffText, "text/xml")
    const fileEl = doc.querySelector("file")
    if (!fileEl) throw new Error("No <file> found in XLIFF 1.2")

    const trgLang = fileEl.getAttribute("target-language")
    if (!trgLang) throw new Error("No target-language in XLIFF 1.2")

    const targetLocale = locales.find(l => l.code === trgLang)
    if (!targetLocale) throw new Error(`Locale ${trgLang} not found`)

    const valuesBySource: ValuesBySource = {}
    const units = fileEl.querySelectorAll("trans-unit")

    units.forEach(unit => {
        const id = unit.getAttribute("id")
        const target = unit.querySelector("target")?.textContent
        if (id && target) {
            valuesBySource[id] = {
                [targetLocale.id]: { action: "set", value: target },
            }
        }
    })

    return { valuesBySource, targetLocale }
}

export function parseXliff20(xliffText: string, locales: readonly Locale[]) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xliffText, "text/xml")
    const xliffEl = doc.querySelector("xliff")
    if (!xliffEl) throw new Error("No <xliff> found in XLIFF 2.0")

    const trgLang = xliffEl.getAttribute("trgLang")
    if (!trgLang) throw new Error("No trgLang in XLIFF 2.0")

    const targetLocale = locales.find(l => l.code === trgLang)
    if (!targetLocale) throw new Error(`Locale ${trgLang} not found`)

    const valuesBySource: ValuesBySource = {}
    const units = xliffEl.querySelectorAll("unit")

    units.forEach(unit => {
        const id = unit.getAttribute("id")
        const target = unit.querySelector("target")?.textContent
        if (id && target) {
            valuesBySource[id] = {
                [targetLocale.id]: { action: "set", value: target },
            }
        }
    })

    return { valuesBySource, targetLocale }
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
