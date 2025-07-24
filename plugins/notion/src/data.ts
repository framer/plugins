import type { DatabaseObjectResponse, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import {
    type ArrayItemInput,
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
} from "framer-plugin"
import pLimit from "p-limit"
import * as v from "valibot"
import {
    assertFieldTypeMatchesPropertyType,
    type FieldInfo,
    getDatabase,
    getDatabaseFieldsInfo,
    getDatabaseItems,
    getNotionDatabases,
    getPageBlocksAsRichText,
    getSlugValue,
    isUnchangedSinceLastSync,
    PLUGIN_KEYS,
    pageContentProperty,
    pageCoverProperty,
    richTextToPlainText,
} from "./api"
import { richTextToHtml } from "./blocksToHtml"
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
    const fieldsById = new Map(fields.map(field => [field.id, field]))

    const seenItemIds = new Set<string>()

    const databaseItems = await getDatabaseItems(dataSource.database)
    const limit = pLimit(CONCURRENCY_LIMIT)

    const promises = databaseItems.map((item, index) =>
        limit(async () => {
            seenItemIds.add(item.id)

            let skipContent = false
            if (isUnchangedSinceLastSync(item.last_edited_time, lastSynced)) {
                console.warn({
                    message: `Skipping content update. last updated: ${formatDate(item.last_edited_time)}, last synced: ${lastSynced ? formatDate(lastSynced) : "never"}`,
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

                const field = fieldsById.get(property.id)
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

            if (!slugValue) {
                console.warn(`Skipping item at index ${index} because it doesn't have a valid slug`)
                return null
            }

            if (fieldsById.has(pageContentProperty.id) && item.id && !skipContent) {
                const contentHTML = await getPageBlocksAsRichText(item.id)
                fieldData[pageContentProperty.id] = { type: "formattedText", value: contentHTML }
            }

            if (fieldsById.has(pageCoverProperty.id)) {
                let coverValue: string | null = null

                if (item.cover) {
                    switch (item.cover.type) {
                        case "external":
                            coverValue = item.cover.external.url
                            break
                        case "file":
                            coverValue = item.cover.file.url
                            break
                        default:
                            item.cover satisfies never
                    }
                }

                fieldData[pageCoverProperty.id] = { type: "image", value: coverValue }
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

const IgnoredFieldIdsSchema = v.array(v.string())

export function parseIgnoredFieldIds(ignoredFieldIdsStringified: string | null): Set<string> {
    return ignoredFieldIdsStringified
        ? new Set(v.parse(IgnoredFieldIdsSchema, JSON.parse(ignoredFieldIdsStringified)))
        : new Set<string>()
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

        const dataSourceFieldsInfo = getDatabaseFieldsInfo(dataSource.database, databaseIdMap)
        const fieldsInfo = mergeFieldsInfoWithExistingFields(dataSourceFieldsInfo, existingFields)
        const fields = fieldsInfoToCollectionFields(fieldsInfo, databaseIdMap)

        const slugField = fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        const ignoredFieldIds = parseIgnoredFieldIds(previousIgnoredFieldIds)

        const fieldsToSync = fields.filter(
            field =>
                existingFields.some(existingField => existingField.id === field.id) && !ignoredFieldIds.has(field.id)
        )

        await syncCollection(collection, dataSource, fieldsToSync, slugField, ignoredFieldIds, previousLastSynced)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(
            `Failed to sync database “${previousDatabaseName ?? previousDatabaseId}”. Check browser console for more details.`,
            { variant: "error" }
        )
        return { didSync: false }
    }
}

export function fieldsInfoToCollectionFields(
    fieldsInfo: FieldInfo[],
    databaseIdMap: DatabaseIdMap
): ManagedCollectionFieldInput[] {
    const fields: ManagedCollectionFieldInput[] = []

    for (const fieldInfo of fieldsInfo) {
        const property = fieldInfo.notionProperty
        const fieldType = fieldInfo.type
        const fieldName = fieldInfo.name.trim() || fieldInfo.id

        if (fieldInfo.id === pageContentProperty.id) {
            fields.push({
                type: "formattedText",
                id: fieldInfo.id,
                name: fieldName,
                userEditable: false,
            })
            continue
        } else if (fieldInfo.id === pageCoverProperty.id) {
            fields.push({
                type: "image",
                id: fieldInfo.id,
                name: fieldName,
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
            case "color": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)
                fields.push({
                    type: fieldType,
                    id: fieldInfo.id,
                    name: fieldName,
                    userEditable: false,
                })
                break
            }
            case "enum": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)

                let cases: Extract<ManagedCollectionFieldInput, { type: "enum" }>["cases"] | null = null
                switch (property.type) {
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
                        name: fieldName,
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
                    name: fieldName,
                    allowedFileTypes: [],
                    userEditable: false,
                })
                break
            }
            case "array": {
                fields.push({
                    type: fieldType,
                    id: property.id,
                    name: property.name,
                    userEditable: false,
                    fields: [{ id: `${property.id}-image`, type: "image", name: "Image" }],
                })
                break
            }
            case "multiCollectionReference": {
                assertFieldTypeMatchesPropertyType(property.type, fieldType)

                if (property.type === "relation") {
                    const databaseId = property.relation.database_id
                    if (databaseId) {
                        const collectionId = databaseIdMap.get(databaseId)
                        if (collectionId) {
                            fields.push({
                                type: "multiCollectionReference",
                                id: fieldInfo.id,
                                name: fieldName,
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

export function getFieldDataEntryForProperty(
    property: PageObjectResponse["properties"][string],
    field: ManagedCollectionFieldInput
): FieldDataEntryInput | null {
    switch (property.type) {
        case "checkbox": {
            return { type: "boolean", value: property.checkbox }
        }
        case "last_edited_time": {
            return { type: "date", value: property.last_edited_time }
        }
        case "created_time": {
            return { type: "date", value: property.created_time }
        }
        case "rich_text": {
            if (field.type === "formattedText") {
                return { type: "formattedText", value: richTextToHtml(property.rich_text) }
            } else if (field.type === "color") {
                return { type: "color", value: richTextToPlainText(property.rich_text) || null }
            }

            return { type: "string", value: richTextToPlainText(property.rich_text) }
        }
        case "select": {
            if (field.type !== "enum") return null

            if (!property.select) {
                const firstCase = field.cases[0]?.id
                return firstCase ? { type: "enum", value: firstCase } : null
            }

            return { type: "enum", value: property.select.id }
        }
        case "status": {
            if (field.type !== "enum") return null

            if (!property.status) {
                const firstCase = field.cases[0]?.id
                return firstCase ? { type: "enum", value: firstCase } : null
            }

            return { type: "enum", value: property.status.id }
        }
        case "title": {
            if (field.type === "formattedText") {
                return { type: "formattedText", value: richTextToHtml(property.title) }
            }

            return { type: "string", value: richTextToPlainText(property.title) }
        }
        case "number": {
            return { type: "number", value: property.number ?? 0 }
        }
        case "url": {
            return { type: "link", value: property.url ?? "" }
        }
        case "unique_id": {
            if (field.type !== "string" && field.type !== "number") return null

            if (field.type === "string") {
                return {
                    type: "string",
                    value: property.unique_id.prefix
                        ? `${property.unique_id.prefix}-${String(property.unique_id.number)}`
                        : String(property.unique_id.number),
                }
            }

            return { type: "number", value: property.unique_id.number ?? 0 }
        }
        case "date": {
            return { type: "date", value: property.date?.start ?? null }
        }
        case "relation": {
            return { type: "multiCollectionReference", value: property.relation.map(({ id }) => id) }
        }
        case "files": {
            if (field.type === "array") {
                const imageField = field.fields[0]

                return {
                    type: "array",
                    value: property.files
                        .map((file): ArrayItemInput | undefined => {
                            switch (file.type) {
                                case "external":
                                    return {
                                        id: file.name,
                                        fieldData: {
                                            [imageField.id]: {
                                                type: "image",
                                                value: file.external.url,
                                            },
                                        },
                                    }
                                case "file":
                                    return {
                                        id: file.name,
                                        fieldData: {
                                            [imageField.id]: {
                                                type: "image",
                                                value: file.file.url,
                                            },
                                        },
                                    }
                                case undefined:
                                    return
                                default:
                                    file satisfies never
                            }
                        })
                        .filter(file => file !== undefined),
                }
            }

            if (field.type !== "file" && field.type !== "image") return null

            const firstFile = property.files[0]

            switch (firstFile?.type) {
                case "external":
                    return { type: field.type, value: firstFile.external.url }
                case "file":
                    return { type: field.type, value: firstFile.file.url }
                default:
                    return { type: field.type, value: null }
            }
        }
        case "email": {
            if (field.type !== "formattedText" && field.type !== "string") return null

            return { type: field.type, value: property.email ?? "" }
        }
        case "phone_number": {
            if (field.type !== "string" && field.type !== "link") return null

            const phoneNumber = property.phone_number ?? ""

            if (field.type === "link") {
                return { type: "link", value: phoneNumber ? `tel:${phoneNumber}` : null }
            }

            return { type: "string", value: phoneNumber }
        }
    }

    return null
}

export async function getExistingCollectionDatabaseIdMap(): Promise<DatabaseIdMap> {
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
