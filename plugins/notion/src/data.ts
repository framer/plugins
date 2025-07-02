import type { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import { type FieldDataInput, framer, ManagedCollection, type ManagedCollectionFieldInput } from "framer-plugin"
import pLimit from "p-limit"
import {
    assertFieldTypeMatchesPropertyType,
    type FieldInfo,
    getDatabase,
    getDatabaseFieldsInfo,
    getDatabaseItems,
    getFieldDataEntryForProperty,
    getNotionDatabases,
    getPageBlocksAsRichText,
    getSlugValue,
    isUnchangedSinceLastSync,
    PLUGIN_KEYS,
    pageContentProperty,
    richTextToPlainText,
} from "./api"
import { formatDate, isNotNull, slugify, syncMethods } from "./utils"

// Maximum number of concurrent requests to Notion API
// This is to prevent rate limiting.
const CONCURRENCY_LIMIT = 5

export type DatabaseIdMap = Map<string, string>

export interface DataSource {
    id: string
    name: string
    database: DatabaseObjectResponse
}

export async function getDataSources(): Promise<DataSource[]> {
    const databases = await getNotionDatabases()

    return databases.map((database: DatabaseObjectResponse) => {
        return {
            id: database.id,
            name: richTextToPlainText(database.title) || "Untitled Database",
            database,
        }
    })
}

export function getDataSourceFieldsInfo(database: DatabaseObjectResponse, databaseIdMap: DatabaseIdMap): FieldInfo[] {
    return getDatabaseFieldsInfo(database, databaseIdMap)
}

/**
 * Retrieve Notion database and get name and id.
 */
export async function getDataSource(databaseId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    // Fetch from your data source
    const database = await getDatabase(databaseId)

    if (abortSignal?.aborted) {
        throw new Error("Database loading cancelled")
    }

    return {
        id: database.id,
        name: richTextToPlainText(database.title) || "Untitled Database",
        database,
    }
}

export function mergeFieldsInfoWithExistingFields(
    sourceFieldsInfo: readonly FieldInfo[],
    existingFields: readonly ManagedCollectionFieldInput[]
): FieldInfo[] {
    return sourceFieldsInfo.map(sourceFieldInfo => {
        const existingField = existingFields.find(existingField => existingField.id === sourceFieldInfo.id)
        if (existingField && sourceFieldInfo.allowedTypes.includes(existingField.type)) {
            return { ...sourceFieldInfo, name: existingField.name, type: existingField.type }
        }
        return sourceFieldInfo
    })
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly ManagedCollectionFieldInput[],
    slugField: ManagedCollectionFieldInput,
    ignoredFieldIds: Set<string>,
    lastSynced: string | null
) {
    const sanitizedFields = fields.map(field => ({
        ...field,
        name: field.name.trim() || field.id,
    }))
    const sanitizedFieldsById = new Map(sanitizedFields.map(field => [field.id, field]))

    const seenItemIds = new Set<string>()

    const databaseItems = await getDatabaseItems(dataSource.database)
    const limit = pLimit(CONCURRENCY_LIMIT)

    const promises = databaseItems.map((item, index) =>
        limit(async () => {
            if (!item) throw new Error("Logic error")

            seenItemIds.add(item.id)

            let skipContent = false
            if (isUnchangedSinceLastSync(item.last_edited_time, lastSynced)) {
                console.warn({
                    message: `Skipping content update. last updated: ${formatDate(item.last_edited_time)}, last synced: ${formatDate(lastSynced!)}`,
                    url: item.url,
                })
                skipContent = true
            }

            let slugValue: null | string = null
            const fieldData: FieldDataInput = {}

            for (const property of Object.values(item.properties)) {
                if (property.id === slugField.id) {
                    const slug = getSlugValue(property)

                    if (!slug) break

                    slugValue = slugify(slug)
                }

                const field = sanitizedFieldsById.get(property.id)
                if (!field) continue

                const fieldEntry = getFieldDataEntryForProperty(property, field)
                if (fieldEntry) {
                    fieldData[field.id] = fieldEntry
                } else {
                    console.warn(
                        `Skipping item at index ${index} because it doesn't have a valid value for field ${field.name}`
                    )
                }
            }

            if (!slugValue || typeof slugValue !== "string") {
                console.warn(`Skipping item at index ${index} because it doesn't have a valid slug`)
                return null
            }

            if (sanitizedFieldsById.has(pageContentProperty.id) && item.id && !skipContent) {
                const contentHTML = await getPageBlocksAsRichText(item.id)
                fieldData[pageContentProperty.id] = { type: "formattedText", value: contentHTML }
            }

            return {
                id: item.id,
                slug: slugValue,
                draft: false,
                fieldData,
            }
        })
    )

    const result = await Promise.all(promises)
    const items = result.filter(isNotNull)

    const itemIdsToDelete = new Set(await collection.getItemIds())
    for (const itemId of seenItemIds) {
        itemIdsToDelete.delete(itemId)
    }

    await collection.setFields(sanitizedFields)
    await collection.removeItems(Array.from(itemIdsToDelete))
    await collection.addItems(items)

    await Promise.all([
        collection.setPluginData(
            PLUGIN_KEYS.IGNORED_FIELD_IDS,
            ignoredFieldIds.size > 0 ? JSON.stringify(Array.from(ignoredFieldIds)) : null
        ),
        collection.setPluginData(PLUGIN_KEYS.DATABASE_ID, dataSource.database.id),
        collection.setPluginData(PLUGIN_KEYS.LAST_SYNCED, new Date().toISOString()),
        collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugField.id),
        collection.setPluginData(PLUGIN_KEYS.DATABASE_NAME, richTextToPlainText(dataSource.database.title)),
    ])
}

export async function syncExistingCollection(
    collection: ManagedCollection,
    previousDatabaseId: string | null,
    previousSlugFieldId: string | null,
    previousIgnoredFieldIds: string | null,
    previousLastSynced: string | null,
    previousDatabaseName: string | null,
    databaseIdMap: DatabaseIdMap
): Promise<{ didSync: boolean }> {
    const isAllowedToSync = framer.isAllowedTo(...syncMethods)
    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId || !previousDatabaseId || !isAllowedToSync) {
        return { didSync: false }
    }

    try {
        const dataSource = await getDataSource(previousDatabaseId)
        const existingFields = await collection.getFields()

        const dataSourceFieldsInfo = getDataSourceFieldsInfo(dataSource.database, databaseIdMap)
        const fieldsInfo = mergeFieldsInfoWithExistingFields(dataSourceFieldsInfo, existingFields)
        const fields = await fieldsInfoToCollectionFields(fieldsInfo, databaseIdMap)

        const slugField = fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        const ignoredFieldIds: Set<string> = previousIgnoredFieldIds
            ? new Set(JSON.parse(previousIgnoredFieldIds))
            : new Set()

        const fieldsToSync = fields.filter(
            field =>
                existingFields.some(existingField => existingField.id === field.id) && !ignoredFieldIds.has(field.id)
        )

        await syncCollection(collection, dataSource, fieldsToSync, slugField, ignoredFieldIds, previousLastSynced)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(
            `Failed to sync database “${previousDatabaseName || previousDatabaseId}”. Check browser console for more details.`,
            { variant: "error" }
        )
        return { didSync: false }
    }
}

export async function fieldsInfoToCollectionFields(
    fieldsInfo: FieldInfo[],
    databaseIdMap: DatabaseIdMap
): Promise<ManagedCollectionFieldInput[]> {
    const fields: ManagedCollectionFieldInput[] = []

    for (const fieldInfo of fieldsInfo) {
        const property = fieldInfo.notionProperty
        const fieldType = fieldInfo.type

        if (fieldInfo.id === pageContentProperty.id) {
            fields.push({
                type: "formattedText",
                id: fieldInfo.id,
                name: fieldInfo.name,
                userEditable: false,
            })
            continue
        }

        if (!property || !fieldType) continue

        switch (fieldType) {
            case "boolean":
            case "date":
            case "number":
            case "string":
            case "formattedText":
            case "link":
            case "image": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)
                fields.push({
                    type: fieldType,
                    id: fieldInfo.id,
                    name: fieldInfo.name,
                    userEditable: false,
                })
                break
            }
            case "enum": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)

                let cases: Extract<ManagedCollectionFieldInput, { type: "enum" }>["cases"] | null = null
                switch (property?.type) {
                    case "select":
                        cases = property.select.options.map(option => ({
                            id: option.id,
                            name: option.name,
                        }))
                        break
                    case "status":
                        cases = property.status.options.map(option => ({
                            id: option.id,
                            name: option.name,
                        }))
                        break
                }

                if (cases) {
                    fields.push({
                        type: "enum",
                        id: fieldInfo.id,
                        name: fieldInfo.name,
                        cases,
                        userEditable: false,
                    })
                }

                break
            }
            case "file": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)
                fields.push({
                    type: "file",
                    id: fieldInfo.id,
                    name: fieldInfo.name,
                    allowedFileTypes: [],
                    userEditable: false,
                })
                break
            }
            case "multiCollectionReference": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)

                if (property.type === "relation") {
                    const databaseId = property.relation?.database_id
                    if (databaseId && databaseIdMap) {
                        const collectionId = databaseIdMap.get(databaseId)
                        if (collectionId) {
                            fields.push({
                                type: "multiCollectionReference",
                                id: fieldInfo.id,
                                name: fieldInfo.name,
                                collectionId,
                                userEditable: false,
                            })
                        }
                    }
                }
                break
            }
            default:
                throw new Error(`Unsupported field type: ${fieldType}`)
        }
    }

    return fields
}

export async function getDatabaseIdMap(): Promise<DatabaseIdMap> {
    const databaseIdMap: DatabaseIdMap = new Map()
    const promises: Promise<void>[] = []

    for (const collection of await framer.getCollections()) {
        const task = async () => {
            const collectionDatabaseId = await collection.getPluginData(PLUGIN_KEYS.DATABASE_ID)
            if (!collectionDatabaseId) return
            databaseIdMap.set(collectionDatabaseId, collection.id)
        }

        promises.push(task())
    }

    await Promise.all(promises)
    return databaseIdMap
}
