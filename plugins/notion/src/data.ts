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
} from "./api"
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
    slugField: ManagedCollectionFieldInput
) {
    const sanitizedFields = fields.map(field => ({
        ...field,
        name: field.name.trim() || field.id,
    }))

    const items: ManagedCollectionItemInput[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    for (let i = 0; i < dataSource.items.length; i++) {
        const item = dataSource.items[i]
        if (!item) throw new Error("Logic error")

        const slugValue = item[slugField.id]
        if (!slugValue || typeof slugValue.value !== "string") {
            console.warn(`Skipping item at index ${i} because it doesn't have a valid slug`)
            continue
        }

        unsyncedItems.delete(slugValue.value)

        const fieldData: FieldDataInput = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = sanitizedFields.find(field => field.id === fieldName)

            // Field is in the data but skipped based on selected fields.
            if (!field) continue

            // For details on expected field value, see:
            // https://www.framer.com/developers/plugins/cms#collections
            fieldData[field.id] = value
        }

        items.push({
            id: slugValue.value,
            slug: slugValue.value,
            draft: false,
            fieldData,
        })
    }

    await collection.setFields(sanitizedFields)
    await collection.removeItems(Array.from(unsyncedItems))
    await collection.addItems(items)

    await collection.setPluginData(PLUGIN_KEYS.DATABASE_ID, dataSource.database.id)
    await collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugField.id)
}

export async function syncExistingCollection(
    collection: ManagedCollection,
    previousDataSourceId: string | null,
    previousSlugFieldId: string | null
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

        const slugField = dataSource.fields.find(field => field.id === previousSlugFieldId)
        if (!slugField) {
            framer.notify(`No field matches the slug field id “${previousSlugFieldId}”. Sync will not be performed.`, {
                variant: "error",
            })
            return { didSync: false }
        }

        await syncCollection(collection, dataSource, existingFields, slugField)
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
