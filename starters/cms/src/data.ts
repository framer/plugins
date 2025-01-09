import type { CollectionItemData, ManagedCollection, ManagedCollectionField } from "framer-plugin"

import { framer } from "framer-plugin"

export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
} as const

export interface DataSource {
    id: string
    fields: readonly ManagedCollectionField[]
    items: Record<string, unknown>[]
}

export function getDataSources() {
    return [
        { id: "articles", name: "Articles" },
        { id: "categories", name: "Categories" },
    ]
}

type CustomDataSourceSchema = {
    id: string
    fields: {
        name: string
        type: ManagedCollectionField["type"]
    }[]
    items: Record<string, unknown>[]
}

/**
 * Retrieve raw data and process it into a structured format.
 *
 * @example
 * {
 *   id: "articles",
 *   fields: [
 *     { id: "title", name: "Title", type: "string", userEditable: false },
 *     { id: "content", name: "Content", type: "formattedText", userEditable: false }
 *   ],
 *   items: [
 *     { title: "My First Article", content: "Hello world" },
 *     { title: "Another Article", content: "More content here" }
 *   ]
 * }
 */
export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    // Fetch from your data source
    const dataSourceResponse = await fetch(`/datasources/${dataSourceId}.json`, { signal: abortSignal })
    const dataSource: CustomDataSourceSchema = await dataSourceResponse.json()

    // Map your source fields to supported field types in Framer
    const fields: ManagedCollectionField[] = []
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
                    userEditable: false,
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

    return {
        id: dataSource.id,
        fields,
        items: dataSource.items,
    }
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly ManagedCollectionField[],
    existingFields: readonly ManagedCollectionField[]
): ManagedCollectionField[] {
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
    fields: readonly ManagedCollectionField[],
    slugField: ManagedCollectionField
) {
    const sanitizedFields = fields.map(field => ({
        ...field,
        name: field.name.trim() || field.id,
    }))

    const items: CollectionItemData[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    for (let i = 0; i < dataSource.items.length; i++) {
        const item = dataSource.items[i]
        const slugValue = item[slugField.id]
        if (typeof slugValue !== "string" || !slugValue) {
            console.warn(`Skipping item at index ${i} because it doesn't have a valid slug`)
            continue
        }

        unsyncedItems.delete(slugValue)

        const fieldData: CollectionItemData["fieldData"] = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = sanitizedFields.find(field => field.id === fieldName)

            // Field is in the data but skipped based on selected fields.
            if (!field) continue

            // For details on expected field value, see:
            // https://www.framer.com/developers/plugins/cms#collections
            fieldData[field.id] = value
        }

        items.push({
            id: slugValue,
            slug: slugValue,
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
