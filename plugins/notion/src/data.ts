import {
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
    type CollectionItemData,
    type ManagedCollectionField,
    type FieldData,
    type FieldDataInput,
    type ManagedCollectionItemInput,
    type EnumCase,
} from "framer-plugin"
import {
    getNotionDatabases,
    getDatabase,
    richTextToPlainText,
    pageContentProperty,
    getDatabaseFieldsInfo,
    PLUGIN_KEYS,
    assertFieldTypeMatchesPropertyType,
    getDatabaseIdMap,
    type FieldInfo,
    getDatabaseItems,
    getPropertyValue,
    getPageBlocksAsRichText,
} from "./api"
import { slugify } from "./utils"
import type { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"

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
 * Retrieve data and process it into a structured format.
 *
 * @example
 * {
 *   id: "articles",
 *   fields: [
 *     { id: "title", name: "Title", type: "string" },
 *     { id: "content", name: "Content", type: "formattedText" }
 *   ],
 *   items: [
 *     { title: "My First Article", content: "Hello world" },
 *     { title: "Another Article", content: "More content here" }
 *   ]
 * }
 */
export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    // Fetch from your data source
    const database = await getDatabase(dataSourceId)

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

    const items: ManagedCollectionItemInput[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    const databaseItems = await getDatabaseItems(dataSource.database)

    for (let i = 0; i < databaseItems.length; i++) {
        const item = databaseItems[i]
        if (!item) throw new Error("Logic error")

        let slugValue: null | string = null
        const fieldData: FieldDataInput = {}

        for (const property of Object.values(item.properties)) {
            if (property.id === slugField.id) {
                const resolvedSlug = getPropertyValue(property, { supportsHtml: false })

                if (!resolvedSlug || typeof resolvedSlug !== "string") {
                    break
                }

                slugValue = slugify(resolvedSlug)
            }

            const field = sanitizedFieldsById.get(property.id)
            if (!field) continue

            const fieldValue = getPropertyValue(property, { supportsHtml: field.type === "formattedText" })
            if (fieldValue === null || fieldValue === undefined) {
                console.warn(
                    `Skipping item at index ${i} because it doesn't have a valid value for field ${field.name}`
                )
            }

            fieldData[field.id] = { type: field.type, value: fieldValue }
        }

        if (!slugValue || typeof slugValue !== "string") {
            console.warn(`Skipping item at index ${i} because it doesn't have a valid slug`)
            continue
        }

        if (sanitizedFieldsById.has(pageContentProperty.id) && item.id) {
            const contentHTML = await getPageBlocksAsRichText(item.id)
            fieldData[pageContentProperty.id] = { type: "formattedText", value: contentHTML }
        }

        unsyncedItems.delete(item.id)

        items.push({
            id: item.id,
            slug: slugValue,
            draft: false,
            fieldData,
        })
    }

    await collection.setFields(sanitizedFields)
    await collection.removeItems(Array.from(unsyncedItems))
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
    previousIgnoredFieldIds: string | null
): Promise<{ didSync: boolean }> {
    if (!previousDataSourceId) {
        return { didSync: false }
    }

    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId) {
        return { didSync: false }
    }

    try {
        const dataSource = await getDataSource(previousDataSourceId)
        const existingFields = await collection.getFields()
        const fieldsInfo = getDataSourceFieldsInfo(dataSource.database)
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

        await syncCollection(collection, dataSource, fieldsToSync, slugField, ignoredFieldIds)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
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

    return fields
}
