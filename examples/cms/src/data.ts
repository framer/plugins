import { CollectionItemData, ManagedCollection, ManagedCollectionField, framer } from "framer-plugin"
import { PLUGIN_KEYS } from "./constants"

export type ManagedCollectionFieldType = ManagedCollectionField["type"]

type DataSourceField =
    | {
          type: ManagedCollectionFieldType
      }
    | {
          type: "html"
      }

export interface DataSource {
    id: string
    fields: Record<string, DataSourceField>
    items: Record<string, unknown>[]
}

export function getDataSourcesIds(): string[] {
    return ["articles", "categories"]
}

export async function getDataSource(dataSourceId: string): Promise<DataSource> {
    return await fetch(`/datasources/${dataSourceId}.json`).then(response => response.json())
}

export function computeFieldsFromDataSource(dataSource: DataSource): ManagedCollectionField[] {
    const fields: ManagedCollectionField[] = []

    for (const [fieldId, field] of Object.entries(dataSource.fields)) {
        let type = field.type

        /**
         * Here you can add support for other types, usually you would want to convert your APIs types to Framer types.
         */

        if (type === "html") {
            type = "formattedText"
        }

        fields.push({
            id: fieldId,
            name: fieldId,
            type,
            userEditable: false,
        } as ManagedCollectionField)
    }

    return fields
}

export function mergeFieldsWithExistingFields(
    originalFields: ManagedCollectionField[],
    existingFields: ManagedCollectionField[]
): ManagedCollectionField[] {
    return originalFields.map(field => {
        const existingField = existingFields.find(existingField => existingField.id === field.id)

        return { ...field, name: existingField?.name ?? field.name }
    })
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: ManagedCollectionField[],
    slugFieldId: string
): Promise<void> {
    const items: CollectionItemData[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    const slugField = fields.find(field => field.id === slugFieldId)
    if (!slugField) {
        framer.notify("Slug field not found", {
            variant: "error",
        })
        return
    }

    for (const item of dataSource.items) {
        const slugValue = item[slugField.id]
        if (typeof slugValue !== "string" || !slugValue) {
            framer.notify(`Skipping item ${item.id} because it doesn't have a valid slug`, {
                variant: "warning",
            })
            continue
        }

        unsyncedItems.delete(slugValue)

        const fieldData: CollectionItemData["fieldData"] = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = fields.find(field => field.id === fieldName)

            // Field is in the data but should not be synced
            if (!field) {
                console.warn(`Skipping field ${fieldName} because it may have been ignored`)
                continue
            }

            // In a real-world scenario, we would need to convert the value to the correct type
            fieldData[field.id] = value
        }

        items.push({
            id: slugValue,
            slug: slugValue,
            draft: false,
            fieldData,
        })
    }

    await collection.setFields(fields)
    await collection.removeItems(Array.from(unsyncedItems))
    await collection.addItems(items)

    await collection.setPluginData(PLUGIN_KEYS.COLLECTION_ID, dataSource.id)
    await collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugFieldId)
}

type SyncResult = "success" | "needsSetup" | "needsConfiguration"

export async function syncExistingCollection(
    collection: ManagedCollection,
    dataSourceId: string | null,
    slugFieldId: string | null
): Promise<SyncResult> {
    if (!dataSourceId) {
        return "needsSetup"
    }

    if (framer.mode !== "syncManagedCollection" || !slugFieldId) {
        return "needsConfiguration"
    }

    const dataSource = await getDataSource(dataSourceId)
    const existingFields = await collection.getFields()

    try {
        await syncCollection(collection, dataSource, existingFields, slugFieldId)
        return "success"
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection`, {
            variant: "error",
        })
        return "needsConfiguration"
    }
}
