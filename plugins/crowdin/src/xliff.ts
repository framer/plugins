import { framer } from "framer-plugin"
import * as v from "valibot"
import { ProjectsSchema, StoragesSchema } from "./api-types"
import { API_URL } from "./dataSources"

// -------------------- Get or Create Storage --------------------
export async function getStorageId(fileName: string, accessToken: string): Promise<number> {
    try {
        const storageList = await fetch(`${API_URL}/storages`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        const storageData = await storageList.json()

        // Validate response with valibot
        const parsed = v.safeParse(v.object({ data: v.array(StoragesSchema) }), storageData)
        console.log(parsed)
        console.log(parsed.success)
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
            body: uint8Array, // no `.buffer`, fetch accepts Uint8Array
        })

        const storageData = await storageRes.json()
        return storageData.data.id as number
    } catch (err) {
        console.error("Error in createStorage:", err)
        throw err
    }
}

// -------------------- Get or Create File --------------------
export async function getFileId(projectId: string, fileName: string, accessToken: string): Promise<number | undefined> {
    try {
        const filesRes = await fetch(`${API_URL}/projects/${projectId}/files`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const filesData = await filesRes.json()
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

export async function createFile(projectId: string, fileName: string, accessToken: string): Promise<number> {
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

        const fileData = await fileRes.json()
        return fileData.data.id as number
    } catch (err) {
        console.error("Error in createFile:", err)
        throw err
    }
}

// -------------------- Add Strings --------------------
export async function addStrings(projectId: string, fileName: string, accessToken: string): Promise<void> {
    try {
        const fileId = await getFileId(projectId, fileName, accessToken)
        if (!fileId) return

        const groups = await framer.getLocalizationGroups()
        const existingMap = await getExistingStrings(projectId, fileId, accessToken)
        console.log(existingMap)
        for (const group of groups) {
            for (const src of group.sources) {
                if (!src.id) continue
                const existing = existingMap.get(src.id)
                console.log(existing)
                if (existing) {
                    if (existing.text !== src.value) {
                        await fetch(`${API_URL}/projects/${projectId}/strings/${existing.id}`, {
                            method: "PUT",
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                text: src.value,
                            }),
                        })
                    }
                } else {
                    await fetch(`${API_URL}/projects/${projectId}/strings`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            text: src.value,
                            identifier: src.id,
                            fileId,
                        }),
                    })
                }
            }
        }
    } catch (err) {
        console.error("Error in addStrings:", err)
        throw err
    }
}

export async function getExistingStrings(projectId: string, fileId: number, accessToken: string) {
    try {
        const existingRes = await fetch(`${API_URL}/projects/${projectId}/strings?fileId=${fileId}&limit=500`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const existingJson = await existingRes.json()
        const existingStrings: Record<string, any>[] = existingJson.data ?? []
        return new Map(existingStrings.map(item => [item.data.identifier, item.data]))
    } catch (err) {
        console.error("Error in addStrings:", err)
        throw err
    }
}
