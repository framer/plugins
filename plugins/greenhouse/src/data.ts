import {
    type FieldDataInput,
    framer,
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
    type ProtectedMethod,
} from "framer-plugin"
import { dataSources, type GreenhouseDataSource, type GreenhouseField } from "./dataSources"
import { decodeHtml, isCollectionReference } from "./utils"

export const dataSourceIdPluginKey = "dataSourceId"
export const slugFieldIdPluginKey = "slugFieldId"
export const spaceIdPluginKey = "spaceId"

function getApiEndpoint(boardToken: string, dataSource: GreenhouseDataSource) {
    return `https://boards-api.greenhouse.io/v1/boards/${boardToken}/${dataSource.apiEndpoint}`
}

function replaceSupportedCollections(
    dataSource: GreenhouseDataSource,
    fieldToCollectionsMap: Map<string, ManagedCollection[]>
): GreenhouseDataSource {
    const fields = dataSource.fields.map(field => {
        if (!isCollectionReference(field)) return field

        const matchingCollections = fieldToCollectionsMap.get(field.id)

        return {
            ...field,
            collectionId: matchingCollections?.[0]?.id ?? "",
            supportedCollections:
                matchingCollections?.map(collection => ({
                    id: collection.id,
                    name: collection.name,
                })) ?? [],
        }
    })

    return { ...dataSource, fields }
}

export async function getDataSource(boardToken: string, dataSourceId: string): Promise<GreenhouseDataSource> {
    if (!boardToken) {
        throw new Error("No Board Token found. Please select a board.")
    }

    const dataSource = dataSources.find(option => option.id === dataSourceId)
    if (!dataSource) {
        throw new Error(`No data source found for id "${dataSourceId}".`)
    }

    const fieldToCollectionsMap = new Map<string, ManagedCollection[]>()
    const boardCollections: ManagedCollection[] = []

    const managedCollections = await framer.getManagedCollections()
    for (const collection of managedCollections) {
        const collectionBoardToken = await collection.getPluginData(spaceIdPluginKey)
        if (collectionBoardToken !== boardToken) {
            continue
        }

        boardCollections.push(collection)
    }

    if (boardCollections.length > 0) {
        for (const field of dataSource.fields) {
            if (field.type !== "multiCollectionReference" && field.type !== "collectionReference") {
                continue
            }

            const matchingCollections: ManagedCollection[] = []
            for (const collection of boardCollections) {
                const collectionDataSourceId = await collection.getPluginData(dataSourceIdPluginKey)
                if (collectionDataSourceId !== field.dataSourceId) {
                    continue
                }

                matchingCollections.push(collection)
            }

            fieldToCollectionsMap.set(field.id, matchingCollections)
        }
    }

    return replaceSupportedCollections(dataSource, fieldToCollectionsMap)
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly GreenhouseField[],
    existingFields: readonly ManagedCollectionFieldInput[]
): GreenhouseField[] {
    return sourceFields.map(sourceField => {
        const existingField = existingFields.find(existingField => existingField.id === sourceField.id)
        if (existingField) {
            return { ...sourceField, name: existingField.name }
        }
        return sourceField
    })
}

async function getItems(
    dataSource: GreenhouseDataSource,
    fieldsToSync: readonly ManagedCollectionFieldInput[],
    { boardToken, slugFieldId }: { boardToken: string; slugFieldId: string }
): Promise<ManagedCollectionItemInput[]> {
    const items: ManagedCollectionItemInput[] = []

    const response = await fetch(getApiEndpoint(boardToken, dataSource))
    const data = await response.json()

    const itemIdBySlug: Map<string, string> = new Map()
    const idField = fieldsToSync[0]
    if (!idField) {
        throw new Error("No ID field found in data source.")
    }

    for (const item of data[dataSource.itemsKey]) {
        const id = String(item[idField.id])
        const slug = String(item[slugFieldId])

        if (!itemIdBySlug.has(slug)) {
            itemIdBySlug.set(slug, id)
            continue
        }

        const uniqueSlug = `${itemIdBySlug.get(slug)}-${id}`
        itemIdBySlug.set(uniqueSlug, id)
    }
    const slugByItemId: Map<string, string> = new Map()
    for (const [slug, itemId] of itemIdBySlug.entries()) {
        slugByItemId.set(itemId, slug)
    }

    for (const item of data[dataSource.itemsKey]) {
        const id = String(item[idField.id])
        const slug = slugByItemId.get(id)
        if (!slug) {
            continue
        }

        const fieldData: FieldDataInput = {}
        for (const [fieldName, rawValue] of Object.entries(item)) {
            const isFieldIgnored = !fieldsToSync.find(field => field.id === fieldName)
            const field = dataSource.fields.find(field => field.id === fieldName)

            if (!field || isFieldIgnored) {
                continue
            }

            const value = field.getValue ? field.getValue(rawValue) : rawValue

            switch (field.type) {
                case "string":
                    fieldData[field.id] = { value: String(value), type: field.type }
                    break
                case "number":
                    fieldData[field.id] = { value: Number(value), type: field.type }
                    break
                case "boolean":
                    fieldData[field.id] = { value: Boolean(value), type: field.type }
                    break
                case "color":
                    fieldData[field.id] = { value: String(value), type: field.type }
                    break
                case "formattedText":
                    fieldData[field.id] = { value: decodeHtml(String(value)), type: field.type }
                    break
                case "date":
                    fieldData[field.id] = { value: String(value), type: field.type }
                    break
                case "link":
                    fieldData[field.id] = { value: String(value), type: field.type }
                    break
                case "multiCollectionReference": {
                    const ids: string[] = []
                    if (Array.isArray(value)) {
                        ids.push(...value.map(item => String(item.id)))
                    }

                    fieldData[field.id] = { value: ids, type: field.type }
                    break
                }
                case "collectionReference": {
                    if (typeof value !== "object" || value == null || !("id" in value)) {
                        continue
                    }

                    fieldData[field.id] = { value: String(value.id), type: field.type }
                    break
                }
            }
        }

        items.push({
            id,
            slug,
            draft: false,
            fieldData,
        })
    }

    return items
}

export async function syncCollection(
    boardToken: string,
    collection: ManagedCollection,
    dataSource: GreenhouseDataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput
) {
    const existingItemsIds = await collection.getItemIds()
    const items = await getItems(dataSource, fields, { boardToken, slugFieldId: slugField.id })
    const unsyncedItems = new Set<string>(
        existingItemsIds.filter(existingItemId => !items.find(item => item.id === existingItemId))
    )

    await collection.removeItems(Array.from(unsyncedItems))
    await collection.addItems(items)

    await collection.setPluginData(spaceIdPluginKey, boardToken)
    await collection.setPluginData(dataSourceIdPluginKey, dataSource.id)
    await collection.setPluginData(slugFieldIdPluginKey, slugField.id)
}

export const syncMethods = [
    "ManagedCollection.removeItems",
    "ManagedCollection.addItems",
    "ManagedCollection.setPluginData",
] as const satisfies ProtectedMethod[]

export async function syncExistingCollection(
    collection: ManagedCollection,
    previousDataSourceId: string | null,
    previousSlugFieldId: string | null,
    previousBoardToken: string | null
): Promise<{ didSync: boolean }> {
    if (!previousDataSourceId || !previousBoardToken) {
        return { didSync: false }
    }

    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId) {
        return { didSync: false }
    }

    if (!framer.isAllowedTo(...syncMethods)) {
        framer.closePlugin("You are not allowed to sync this collection.", {
            variant: "error",
        })
        return { didSync: false }
    }

    try {
        const dataSource = await getDataSource(previousBoardToken, previousDataSourceId)
        const existingFields = await collection.getFields()

        const slugField = dataSource.fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        await syncCollection(previousBoardToken, collection, dataSource, existingFields, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
