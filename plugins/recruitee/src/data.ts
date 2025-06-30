import {
    type FieldDataInput,
    framer,
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
    type ProtectedMethod,
} from "framer-plugin"
import { isRecruiteeItemField } from "./api-types"
import { dataSources, type RecruiteeDataSource, type RecruiteeField } from "./dataSources"
import { assertNever, decodeHtml, isCollectionReference } from "./utils"

export const dataSourceIdPluginKey = "dataSourceId"
export const slugFieldIdPluginKey = "slugFieldId"
export const spaceIdPluginKey = "spaceId"

export const companyIdPluginKey = "companyId"

function replaceSupportedCollections(
    dataSource: RecruiteeDataSource,
    fieldToCollectionsMap: Map<string, ManagedCollection[]>
): RecruiteeDataSource {
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

export async function getDataSource(companyId: string, boardToken: string, dataSourceId: string): Promise<RecruiteeDataSource> {
    if (!companyId) {
        throw new Error("No Company Id Found. Please provide Company ID.")
    }
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
    sourceFields: readonly RecruiteeField[],
    existingFields: readonly ManagedCollectionFieldInput[]
): RecruiteeField[] {
    const existingFieldsMap = new Map(existingFields.map(field => [field.id, field]))

    return sourceFields.map(sourceField => {
        const existingField = existingFieldsMap.get(sourceField.id)
        if (existingField) {
            return { ...sourceField, name: existingField.name }
        }
        return sourceField
    })
}

async function getItems(
    dataSource: RecruiteeDataSource,
    fieldsToSync: readonly ManagedCollectionFieldInput[],
    { boardToken, slugFieldId , companyId}: { boardToken: string; slugFieldId: string; companyId:string }
): Promise<ManagedCollectionItemInput[]> {
    const items: ManagedCollectionItemInput[] = []

    const dataItems = await dataSource.fetch(boardToken, companyId)

    const itemIdBySlug: Map<string, string> = new Map()
    const idField = fieldsToSync[0]
    if (!idField) {
        throw new Error("No ID field found in data source.")
    }

    for (const item of dataItems) {
        if (!isRecruiteeItemField(slugFieldId, item)) {
            throw new Error(`No slug field found in data source.`)
        }

        const id = String(item.id)
        const slug = String(item[slugFieldId]).trim()

        if (!itemIdBySlug.has(slug)) {
            itemIdBySlug.set(slug, id)
            continue
        }

        const uniqueSlug = `${slug} ${id}`
        itemIdBySlug.set(uniqueSlug, id)
    }

    const slugByItemId: Map<string, string> = new Map()
    for (const [slug, itemId] of itemIdBySlug.entries()) {
        slugByItemId.set(itemId, slug)
    }

    for (const item of dataItems) {
        const id = String(item.id)
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
                    fieldData[field.id] = {
                        value: value ? String(value) : "",
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
                        value: decodeHtml(String(value)),
                        type: "formattedText",
                    }
                    break
                case "color":
                case "date":
                case "link":
                    fieldData[field.id] = {
                        value: value ? String(value) : null,
                        type: field.type,
                    }
                    break
                case "multiCollectionReference": {
                    const ids: string[] = []
                    if (Array.isArray(value)) {
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
                    throw new Error(`${field.type} field is not supported.`)
                default:
                    assertNever(field)
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
    companyId: string,
    boardToken: string,
    collection: ManagedCollection,
    dataSource: RecruiteeDataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput
): Promise<void> {
    const existingItemsIds = await collection.getItemIds()
    const items = await getItems(dataSource, fields, {
        boardToken,
        slugFieldId: slugField.id,
        companyId: companyId
    })
    const itemIds = new Set(items.map(item => item.id))
    const unsyncedItemsIds = existingItemsIds.filter(existingItemId => !itemIds.has(existingItemId))

    await collection.removeItems(unsyncedItemsIds)
    await collection.addItems(items)
    await collection.setPluginData(companyIdPluginKey, companyId)
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
    previousBoardToken: string | null,
    previousCompanyId: string | null
): Promise<{ didSync: boolean }> {
    if (!previousDataSourceId || !previousBoardToken || !previousCompanyId) {
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
        const dataSource = await getDataSource(previousCompanyId, previousBoardToken, previousDataSourceId)
        const existingFields = await collection.getFields()

        const slugField = dataSource.fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        await syncCollection(previousCompanyId, previousBoardToken, collection, dataSource, existingFields, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
