import { CollectionItemData, ManagedCollectionField, framer } from "framer-plugin"
import { generateHash, isNotNull, slugify } from "./utils"

// Plugin keys
export const PLUGIN_PREFIX = "cms_starter"
export const LOCAL_STORAGE_LAST_LAUNCH_KEY = `${PLUGIN_PREFIX}.lastLaunched`

export const PLUGIN_COLLECTION_SYNC_REFERENCE_KEY = `collectionSyncReference`
export const PLUGIN_COLLECTION_SYNC_SLUG_KEY = `collectionSyncSlug`

export type ManagedCollectionFieldType = ManagedCollectionField["type"]

type DataSourceField = {
    type: ManagedCollectionFieldType
}

export interface DataSource {
    id: string
    fields: Record<string, DataSourceField>
    items: Record<string, unknown>[]
}

export interface FieldConfig {
    name: string
    isNew: boolean
    field: ManagedCollectionField | null
}

export async function listDataSourcesIds(): Promise<string[]> {
    return ["articles", "categories"]
}

export async function getDataSources(collection: string): Promise<DataSource> {
    return await fetch(`/datasources/${collection}.json`).then(res => res.json())
}

export function computeFieldConfigs(existingFields: ManagedCollectionField[], dataSource: DataSource) {
    const result: FieldConfig[] = []
    const fields = dataSource.fields

    for (const [name, fieldType] of Object.entries(fields)) {
        const fieldId = generateHash(name)
        let newField: ManagedCollectionField | null = null

        const existingField = existingFields.find(field => field.id === fieldId)
        if (existingField) {
            newField = existingField
        } else {
            newField = {
                id: fieldId,
                name,
                type: fieldType.type,
                userEditable: false,
            } as ManagedCollectionField
        }

        result.push({
            name,
            isNew: !existingField,
            field: newField,
        })
    }

    return result
}

export async function syncCollection(
    collection: DataSource,
    fieldConfigs: FieldConfig[],
    slugFieldId: string
): Promise<void> {
    const activeCollection = await framer.getManagedCollection()
    const unsyncedItems = new Set(await activeCollection.getItemIds())

    const items: CollectionItemData[] = []

    const slugField = fieldConfigs.find(fieldConfig => fieldConfig.field?.id === slugFieldId)
    if (!slugField) {
        framer.notify("Slug field not found", {
            variant: "error",
        })
        return
    }

    for (const item of collection.items) {
        const slugValue = item[slugField.name]
        if (typeof slugValue !== "string") {
            framer.notify(`Skipping item ${item.id} because it doesn't have a slug`, {
                variant: "warning",
            })
            continue
        }

        const slug = slugify(slugValue)
        const itemId = generateHash(slug)
        unsyncedItems.delete(itemId)

        const fieldData: CollectionItemData["fieldData"] = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const fieldConfig = fieldConfigs.find(fieldConfig => fieldConfig.name === fieldName)

            // Field is in the data but should not be synced
            if (!fieldConfig?.field) {
                console.warn(`Skipping field ${fieldName} because it may have been ignored`)
                continue
            }

            // In a real-world scenario, we would need to convert the value to the correct type
            fieldData[fieldConfig.field.id] = value
        }

        items.push({
            id: itemId,
            slug: slug,
            draft: false,
            fieldData,
        })
    }

    await activeCollection.setFields(fieldConfigs.map(fieldConfig => fieldConfig.field).filter(isNotNull))
    await activeCollection.removeItems(Array.from(unsyncedItems))
    await activeCollection.addItems(items)

    await activeCollection.setPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY, collection.id)
    await activeCollection.setPluginData(PLUGIN_COLLECTION_SYNC_SLUG_KEY, slugFieldId)
}
