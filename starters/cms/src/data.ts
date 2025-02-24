import type {
    EditableManagedCollectionField,
    FieldDataEntryInput,
    FieldDataInput,
    ManagedCollection,
    ManagedCollectionItemInput,
} from "framer-plugin"

import { framer } from "framer-plugin"

export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
} as const

export function shouldBeNever(_: never) {}

export interface DataSource {
    id: string
    fields: readonly EditableManagedCollectionField[]
    items: FieldDataInput[]
}

export function getDataSources() {
    return [
        { id: "articles", name: "Articles" },
        { id: "categories", name: "Categories" },
    ]
}

function unknownToFieldDataEntryInput(
    value: unknown,
    field: EditableManagedCollectionField
): FieldDataEntryInput | undefined {
    switch (field.type) {
        case "string": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for field: ${field.name}`)
                break
            }
            return { type: "string", value }
        }

        case "number": {
            if (typeof value !== "number") {
                console.error(`Expected a number value for field: ${field.name}`)
                break
            }
            return { type: "number", value }
        }

        case "boolean": {
            if (typeof value !== "boolean") {
                console.error(`Expected a boolean value for field: ${field.name}`)
                break
            }
            return { type: "boolean", value }
        }

        case "date": {
            if (typeof value !== "string" && typeof value !== "number") {
                console.error(`Expected a string or number value for date field: ${field.name}`)
                break
            }
            return { type: "date", value }
        }

        case "enum": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for enum field: ${field.name}`)
                break
            }
            return { type: "enum", value }
        }

        case "color": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for color field: ${field.name}`)
                break
            }
            return { type: "color", value }
        }

        case "link": {
            if (typeof value !== "string") {
                console.error(`Expected a string or object value for link field: ${field.name}`)
                break
            }
            return { type: "link", value }
        }

        case "image": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for image field: ${field.name}`)
                break
            }
            return { type: "image", value }
        }

        case "formattedText": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for formattedText field: ${field.name}`)
                break
            }
            return { type: "formattedText", value }
        }

        case "file": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for file field: ${field.name}`)
                break
            }
            return { type: "file", value }
        }

        case "collectionReference": {
            if (typeof value !== "string") {
                console.error(`Expected a string value for collectionReference field: ${field.name}`)
                break
            }
            return { type: "collectionReference", value }
        }

        case "multiCollectionReference": {
            if (!Array.isArray(value) || !value.every(item => typeof item === "string")) {
                console.error(`Expected a value of an array of strings for field: ${field.name}`)
                break
            }
            return { type: "multiCollectionReference", value }
        }

        default: {
            shouldBeNever(field)
        }
    }
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
    const dataSourceResponse = await fetch(`/data/${dataSourceId}.json`, { signal: abortSignal })
    const dataSource = await dataSourceResponse.json()

    // Map your source fields to supported field types in Framer
    const fields: EditableManagedCollectionField[] = []
    for (const field of dataSource.fields) {
        switch (field.type) {
            case "string":
            case "number":
            case "boolean":
            case "color":
            case "formattedText":
            case "date":
            case "link":
                fields.push({
                    id: field.name,
                    name: field.name,
                    type: field.type,
                })
                break
            case "image":
            case "file":
            case "enum":
            case "collectionReference":
            case "multiCollectionReference":
                console.warn(`Support for field type "${field.type}" is not implemented in this Plugin.`)
                break
            default: {
                console.warn(`Unknown field type "${field.type}".`)
            }
        }
    }

    const items: FieldDataInput[] = dataSource.items.map((item: { [key: string]: unknown }) => {
        const fieldData: FieldDataInput = {}

        for (const [key, value] of Object.entries(item)) {
            const field = fields.find(field => field.id === key)
            if (!field) continue

            const fieldDataEntryInput = unknownToFieldDataEntryInput(value, field)
            if (!fieldDataEntryInput) continue

            fieldData[key] = fieldDataEntryInput
        }

        return fieldData
    })

    return {
        id: dataSource.id,
        fields,
        items,
    }
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly EditableManagedCollectionField[],
    existingFields: readonly EditableManagedCollectionField[]
): EditableManagedCollectionField[] {
    return sourceFields.map(sourceField => {
        const existingField = existingFields.find(existingField => existingField.id === sourceField.id)
        if (existingField) {
            return { ...sourceField, name: existingField.name }
        }
        return sourceField
    })
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly EditableManagedCollectionField[],
    slugField: EditableManagedCollectionField
) {
    const sanitizedFields = fields.map(field => ({
        ...field,
        name: field.name.trim() || field.id,
    }))

    const items: ManagedCollectionItemInput[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    for (let i = 0; i < dataSource.items.length; i++) {
        const item = dataSource.items[i]
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

    await collection.setPluginData(PLUGIN_KEYS.DATA_SOURCE_ID, dataSource.id)
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
