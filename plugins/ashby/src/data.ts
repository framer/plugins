import {
    type FieldDataInput,
    framer,
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
    type ProtectedMethod,
} from "framer-plugin"
import * as v from "valibot"
import { hasOwnProperty } from "./api-types"
import { type AshbyDataSource, type AshbyField, dataSources } from "./dataSources"
import { assertNever, isCollectionReference } from "./utils"

export const dataSourceIdPluginKey = "dataSourceId"
export const slugFieldIdPluginKey = "slugFieldId"
export const jobBoardNamePluginKey = "jobBoardName"

function replaceSupportedCollections(
    dataSource: AshbyDataSource,
    fieldToCollectionsMap: Map<string, ManagedCollection[]>
): AshbyDataSource {
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

export async function getDataSource(jobBoardName: string, dataSourceId: string): Promise<AshbyDataSource> {
    if (!jobBoardName) {
        throw new Error("No Job Board Name found. Please select a board.")
    }

    const dataSource = dataSources.find(option => option.id === dataSourceId)
    if (!dataSource) {
        throw new Error(`No data source found for id "${dataSourceId}".`)
    }

    const fieldToCollectionsMap = new Map<string, ManagedCollection[]>()
    const boardCollections: ManagedCollection[] = []

    const managedCollections = await framer.getManagedCollections()
    for (const collection of managedCollections) {
        const collectionJobBoardName = await collection.getPluginData(jobBoardNamePluginKey)
        if (collectionJobBoardName !== jobBoardName) {
            continue
        }

        boardCollections.push(collection)
    }

    if (boardCollections.length > 0) {
        for (const field of dataSource.fields) {
            if (!isCollectionReference(field)) continue

            const matchingCollections: ManagedCollection[] = []
            for (const collection of boardCollections) {
                const collectionDataSourceId = await collection.getPluginData(dataSourceIdPluginKey)
                if (collectionDataSourceId !== field.dataSourceId) continue

                matchingCollections.push(collection)
            }

            fieldToCollectionsMap.set(field.id, matchingCollections)
        }
    }

    return replaceSupportedCollections(dataSource, fieldToCollectionsMap)
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly AshbyField[],
    existingFields: readonly ManagedCollectionFieldInput[]
): AshbyField[] {
    const existingFieldsMap = new Map(existingFields.map(field => [field.id, field]))

    return sourceFields.map(sourceField => {
        const existingField = existingFieldsMap.get(sourceField.id)
        if (existingField) {
            return { ...sourceField, name: existingField.name }
        }
        return sourceField
    })
}

const StringifiableSchema = v.union([v.string(), v.number(), v.boolean()])
const ArrayWithIdsSchema = v.array(v.object({ id: v.number() }))

async function getItems(
    dataSource: AshbyDataSource,
    fieldsToSync: readonly ManagedCollectionFieldInput[],
    { jobBoardName, slugFieldId }: { jobBoardName: string; slugFieldId: string }
): Promise<ManagedCollectionItemInput[]> {
    const items: ManagedCollectionItemInput[] = []

    const dataItems = await dataSource.fetch(jobBoardName)

    const itemIdBySlug = new Map<string, string>()
    const idField = fieldsToSync[0]
    if (!idField) {
        throw new Error("No ID field found in data source.")
    }

    for (const item of dataItems) {
        if (!hasOwnProperty(item, slugFieldId)) {
            throw new Error(`No slug field found in data source.`)
        }

        const id = String(item.id)
        const slugValue = item[slugFieldId]
        const slug = typeof slugValue === "string" ? slugValue.trim() : null

        if (!slug) {
            console.warn("No slug found for item", item)
            continue
        }

        if (!itemIdBySlug.has(slug)) {
            itemIdBySlug.set(slug, id)
            continue
        }

        const uniqueSlug = `${slug} ${id}`
        itemIdBySlug.set(uniqueSlug, id)
    }

    const slugByItemId = new Map<string, string>()
    for (const [slug, itemId] of itemIdBySlug.entries()) {
        slugByItemId.set(itemId, slug)
    }

    const fieldLookup = new Map<string, AshbyField[]>()
    for (const field of dataSource.fields) {
        const key = field.key ?? field.id
        if (!fieldLookup.has(key)) {
            fieldLookup.set(key, [])
        }
        const existingFields = fieldLookup.get(key)
        if (existingFields) {
            existingFields.push(field)
        }
    }

    for (const item of dataItems) {
        const id = String(item.id)
        const slug = slugByItemId.get(id)
        if (!slug) {
            continue
        }

        const fieldData: FieldDataInput = {}
        for (const [fieldName, rawValue] of Object.entries(item) as [string, unknown][]) {
            const isFieldIgnored = !fieldsToSync.find(field => field.id === fieldName)
            const fields = fieldLookup.get(fieldName) ?? []

            if (fields.length === 0 || isFieldIgnored) {
                continue
            }

            for (const field of fields) {
                const value = field.getValue ? field.getValue(rawValue) : rawValue

                switch (field.type) {
                    case "string":
                        fieldData[field.id] = {
                            value: v.is(StringifiableSchema, value) ? String(value) : "",
                            type: "string",
                        }
                        break
                    case "number":
                        fieldData[field.id] = { value: Number(value), type: "number" }
                        break
                    case "boolean":
                        fieldData[field.id] = { value: Boolean(value), type: "boolean" }
                        break
                    case "formattedText":
                        fieldData[field.id] = {
                            value: v.is(StringifiableSchema, value) ? String(value) : "",
                            type: "formattedText",
                        }
                        break
                    case "color":
                    case "date":
                    case "link":
                        fieldData[field.id] = {
                            value: v.is(StringifiableSchema, value) ? String(value) : null,
                            type: field.type,
                        }
                        break
                    case "multiCollectionReference": {
                        const ids: string[] = []
                        if (v.is(ArrayWithIdsSchema, value)) {
                            ids.push(...value.map(item => String(item.id)))
                        }

                        fieldData[field.id] = {
                            value: ids,
                            type: "multiCollectionReference",
                        }
                        break
                    }
                    case "collectionReference": {
                        if (typeof value !== "object" || value == null || !("id" in value)) {
                            continue
                        }

                        fieldData[field.id] = {
                            value: String(value.id),
                            type: "collectionReference",
                        }
                        break
                    }
                    case "image":
                    case "file":
                    case "enum":
                    case "array":
                        throw new Error(`${field.type} field is not supported.`)
                    default:
                        assertNever(
                            field,
                            new Error(`Unsupported field type: ${(field as unknown as { type: string }).type}`)
                        )
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
    jobBoardName: string,
    collection: ManagedCollection,
    dataSource: AshbyDataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput
): Promise<void> {
    const existingItemsIds = await collection.getItemIds()
    const items = await getItems(dataSource, fields, {
        jobBoardName,
        slugFieldId: slugField.id,
    })
    const itemIds = new Set(items.map(item => item.id))
    const unsyncedItemsIds = existingItemsIds.filter(existingItemId => !itemIds.has(existingItemId))

    await collection.removeItems(unsyncedItemsIds)
    await collection.addItems(items)

    await collection.setPluginData(jobBoardNamePluginKey, jobBoardName)
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
    previousJobBoardName: string | null
): Promise<{ didSync: boolean }> {
    if (!previousDataSourceId || !previousJobBoardName) {
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
        const dataSource = await getDataSource(previousJobBoardName, previousDataSourceId)
        const existingFields = await collection.getFields()

        const slugField = dataSource.fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        await syncCollection(previousJobBoardName, collection, dataSource, existingFields, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
