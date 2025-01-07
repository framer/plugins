import type { CollectionItemData, ManagedCollection, ManagedCollectionField } from "framer-plugin"

import { framer } from "framer-plugin"
import { PLUGIN_KEYS } from "./constants"

export type ManagedCollectionFieldType = ManagedCollectionField["type"]

/**
 * Represents a data source that can be synchronized with a Framer collection.
 *
 * @property id - Unique identifier for the data source
 * @property fields - Array of field definitions that describe the structure of each item
 * @property items - Array of data items, where each item is an object with field values
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
export interface DataSource {
    id: string
    fields: readonly ManagedCollectionField[]
    items: Record<string, unknown>[]
}

/**
 * A data source descriptor is a simple object that describes a data source.
 *
 * @property id - The ID of the data source.
 * @property name - The name of the data source.
 *
 * @example
 * { id: "articles", name: "Articles" }
 */
type DataSourceDescriptor = {
    id: string
    name: string
}

/**
 * Returns an array of available data sources that can be synchronized.
 */
export function getDataSources(): readonly DataSourceDescriptor[] {
    return [
        { id: "articles", name: "Articles" },
        { id: "categories", name: "Categories" },
    ]
}

/**
 * The schema of the data source handled by this Plugin.
 */
type CustomDataSourceSchema = {
    id: string
    fields: {
        name: string
        type: ManagedCollectionFieldType
    }[]
    items: Record<string, unknown>[]
}

/**
 * Fetches and processes data from a specified data source.
 *
 * @param dataSourceId - The unique identifier of the data source to fetch
 * @param [abortSignal] - Optional AbortSignal to cancel the fetch request
 *
 * @returns The processed data source
 */
export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    const dataSource: CustomDataSourceSchema = await fetch(`/datasources/${dataSourceId}.json`, {
        signal: abortSignal,
    }).then(response => response.json())

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

            // Field is in the data but should not be synced
            if (!field) {
                console.warn(
                    `Skipping field "${fieldName}" for item with slug "${slugValue}" because it may have been ignored`
                )
                continue
            }

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
            framer.notify(
                `There is no field matching the slug field id “${previousSlugFieldId}” in the data source. Sync will not be performed.`,
                {
                    variant: "error",
                }
            )
            return { didSync: false }
        }

        await syncCollection(collection, dataSource, existingFields, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check the logs for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
