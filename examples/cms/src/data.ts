import { CollectionItemData, ManagedCollection, ManagedCollectionField, framer } from "framer-plugin"
import { generateHash, isNotNull } from "./utils"
import { PLUGIN_KEYS } from "./constants"

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

export function listDataSourcesIds(): string[] {
    return ["articles", "categories"]
}

export async function getDataSources(collection: string): Promise<DataSource> {
    return await fetch(`/datasources/${collection}.json`).then(response => response.json())
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

        const itemId = generateHash(slugValue)
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
            slug: slugValue,
            draft: false,
            fieldData,
        })
    }

    await activeCollection.setFields(fieldConfigs.map(fieldConfig => fieldConfig.field).filter(isNotNull))
    await activeCollection.removeItems(Array.from(unsyncedItems))
    await activeCollection.addItems(items)

    await activeCollection.setPluginData(PLUGIN_KEYS.SYNC_REFERENCE, collection.id)
    await activeCollection.setPluginData(PLUGIN_KEYS.SYNC_SLUG, slugFieldId)
}

type SyncResult =
    | { status: "success" }
    | { status: "needsSetup"; allDataSources: string[] }
    | {
          status: "needsConfiguration"
          dataSource: DataSource
          existingFields: ManagedCollectionField[]
          savedFieldsConfig: FieldConfig[]
      }

export async function syncExistingCollection(
    collection: ManagedCollection,
    dataSourceId: string | null,
    slugFieldId: string | null
): Promise<SyncResult> {
    if (!dataSourceId) {
        return { status: "needsSetup", allDataSources: listDataSourcesIds() }
    }

    const syncDataSource = await getDataSources(dataSourceId)
    if (!syncDataSource) {
        return { status: "needsSetup", allDataSources: listDataSourcesIds() }
    }

    const existingFields = await collection.getFields()
    const savedFieldsConfig = computeFieldConfigs(existingFields, syncDataSource)

    if (!slugFieldId || framer.mode !== "syncManagedCollection") {
        return { status: "needsConfiguration", dataSource: syncDataSource, existingFields, savedFieldsConfig }
    }

    try {
        await syncCollection(
            syncDataSource,
            savedFieldsConfig.filter(field => field.field && !field.isNew),
            slugFieldId
        )
        return { status: "success" }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection`, {
            variant: "error",
        })
        return { status: "needsConfiguration", dataSource: syncDataSource, existingFields, savedFieldsConfig }
    }
}
