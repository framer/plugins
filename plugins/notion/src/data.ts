import type { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import {
    type EnumCase,
    type FieldDataInput,
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
} from "framer-plugin"
import pLimit from "p-limit"
import {
    assertFieldTypeMatchesPropertyType,
    type FieldInfo,
    getDatabase,
    getDatabaseFieldsInfo,
    getDatabaseIdMap,
    getDatabaseItems,
    getNotionDatabases,
    getPageBlocksAsRichText,
    getPropertyValue,
    isUnchangedSinceLastSync,
    PLUGIN_KEYS,
    pageContentProperty,
    richTextToPlainText,
} from "./api"
import { formatDate, slugify } from "./utils"

// Maximum number of concurrent requests to Notion API
// This is to prevent rate limiting.
const CONCURRENCY_LIMIT = 5

export interface DataSource {
    id: string
    name: string
    database: GetDatabaseResponse
}

export async function getDataSources(): Promise<DataSource[]> {
    const databases = await getNotionDatabases()

    return databases.map((database: GetDatabaseResponse) => {
        return {
            id: database.id,
            name: richTextToPlainText(database.title) || "Untitled Database",
            database,
        }
    })
}

export function getDataSourceFieldsInfo(database: GetDatabaseResponse): FieldInfo[] {
    return getDatabaseFieldsInfo(database)
}

/**
 * Retrieve Notion database and get name and id.
 */
export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    // Fetch from your data source
    const database = await getDatabase(dataSourceId)

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
                    const resolvedSlug = getPropertyValue(property, { type: "string" } as ManagedCollectionFieldInput)

                    if (!resolvedSlug || typeof resolvedSlug !== "string") {
                        break
                    }

                    slugValue = slugify(resolvedSlug)
                }

                const field = sanitizedFieldsById.get(property.id)
                if (!field) continue

                const fieldValue = getPropertyValue(property, field)
                if (fieldValue === null || fieldValue === undefined) {
                    console.warn(
                        `Skipping item at index ${index} because it doesn't have a valid value for field ${field.name}`
                    )
                }

                fieldData[field.id] = { type: field.type, value: fieldValue }
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
    const items = result.filter(Boolean) as ManagedCollectionItemInput[]

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
    previousDataSourceId: string | null,
    previousSlugFieldId: string | null,
    previousIgnoredFieldIds: string | null,
    previousLastSynced: string | null,
    previousDatabaseName: string | null
): Promise<{ didSync: boolean }> {
    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId || !previousDataSourceId) {
        return { didSync: false }
    }

    try {
        const dataSource = await getDataSource(previousDataSourceId)
        const existingFields = await collection.getFields()
        const dataSourceFieldsInfo = getDataSourceFieldsInfo(dataSource.database)
        const fieldsInfo = mergeFieldsInfoWithExistingFields(dataSourceFieldsInfo, existingFields)
        const fields = await fieldsInfoToCollectionFields(fieldsInfo)

        const slugField = fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        const ignoredFieldIds = (
            previousIgnoredFieldIds ? new Set(JSON.parse(previousIgnoredFieldIds)) : new Set()
        ) as Set<string>

        const fieldsToSync = fields.filter(
            field =>
                existingFields.some(existingField => existingField.id === field.id) && !ignoredFieldIds.has(field.id)
        )

        await syncCollection(collection, dataSource, fieldsToSync, slugField, ignoredFieldIds, previousLastSynced)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(
            `Failed to sync database “${previousDatabaseName || previousDataSourceId}”. Check browser console for more details.`,
            { variant: "error" }
        )
        return { didSync: false }
    }
}

export async function fieldsInfoToCollectionFields(fieldsInfo: FieldInfo[]): Promise<ManagedCollectionFieldInput[]> {
    const fields = []

    const databaseIdMap = fieldsInfo.some(fieldInfo => fieldInfo.type === "multiCollectionReference")
        ? await getDatabaseIdMap()
        : null

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
            case "image":
                assertFieldTypeMatchesPropertyType(property.type, fieldType)
                fields.push({
                    type: fieldType,
                    id: fieldInfo.id,
                    name: fieldInfo.name,
                    userEditable: false,
                })
                break
            case "enum":
                assertFieldTypeMatchesPropertyType(property.type, fieldType)

                let cases: EnumCase[] | null = null
                switch (property?.type) {
                    case "select":
                        cases = property.select.options.map(option => ({
                            id: option.id,
                            name: option.name,
                        })) as EnumCase[]
                        break
                    case "status":
                        cases = property.status.options.map(option => ({
                            id: option.id,
                            name: option.name,
                        })) as EnumCase[]
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
            case "file":
                assertFieldTypeMatchesPropertyType(property.type, fieldType)
                fields.push({
                    type: "file",
                    id: fieldInfo.id,
                    name: fieldInfo.name,
                    allowedFileTypes: [],
                    userEditable: false,
                })
                break
            case "multiCollectionReference":
                assertFieldTypeMatchesPropertyType(property.type, fieldType)

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
                break
            default:
                throw new Error(`Unsupported field type: ${fieldType}`)
        }
    }

    return fields as ManagedCollectionFieldInput[]
}
