import { CollectionItemData, ManagedCollectionField, framer } from "framer-plugin"
import { assert, generateHash, slugify } from "./utils"

// Plugin keys
export const PLUGIN_PREFIX = "cms_starter"
export const LOCAL_STORAGE_LAST_LAUNCH_KEY = `${PLUGIN_PREFIX}.lastLaunched`

export const PLUGIN_COLLECTION_SYNC_REFERENCE_KEY = `collectionSyncReference`
export const PLUGIN_COLLECTION_SYNC_SLUG_KEY = `collectionSyncSlug`

export type DataSourceFieldType =
    | "string"
    | "date"
    | "image"
    | "reference"
    | "richText"
    | "number"
    | "boolean"
    | "enum"
    | "color"

/**
 * Mapping of data source field types to managed collection field types.
 */
export const FIELD_MAPPING: Record<DataSourceFieldType, SupportedCollectionFieldTypeWithoutReference[]> = {
    string: [],
    date: ["date"],
    image: ["image", "file", "link"],
    // Special case for reference fields - we need to map the reference field to the collection it references
    reference: [],
    richText: ["formattedText"],
    number: ["number"],
    boolean: ["boolean"],
    enum: ["enum"],
    color: ["color"],
}

export type DataSourceField =
    | {
          type: Exclude<DataSourceFieldType, "reference" | "enum">
      }
    | {
          type: "reference"
          reference: string
          multiple: boolean
      }
    | {
          type: "enum"
          options: string[]
      }

export interface DataSource {
    id: string
    fields: Record<string, DataSourceField>
    items: Record<string, unknown>[]
}

export type SupportedCollectionFieldType = ManagedCollectionField["type"]
export type SupportedCollectionFieldTypeWithoutReference = Exclude<
    SupportedCollectionFieldType,
    "collectionReference" | "multiCollectionReference"
>

/**
 * Reference fields are special fields that reference other collections.
 */
export interface ReferenceField {
    type: "collectionReference" | "multiCollectionReference"
    source: string
    destination: string | null
}

/**
 * Field configuration for a managed collection field.
 */
export interface FieldConfig {
    source: {
        name: string
        type: DataSourceFieldType
        ignored: boolean
    }
    field: ManagedCollectionField | null
    reference: ReferenceField | null
}

interface CollectionDetails {
    id: string
    name: string
}
export const COLLECTIONS_SYNC_MAP: Map<string, CollectionDetails[]> = new Map()

export const allExistingCollections = await framer.getCollections()
for (const collection of allExistingCollections) {
    const reference = await collection.getPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY)
    if (reference) {
        const collectionReferences = COLLECTIONS_SYNC_MAP.get(reference) ?? []
        COLLECTIONS_SYNC_MAP.set(reference, [
            ...collectionReferences,
            {
                id: collection.id,
                name: collection.name,
            },
        ])
    }
}

export function computeFieldConfig(existingFields: ManagedCollectionField[], dataSource: DataSource) {
    const result: FieldConfig[] = []
    const fields = dataSource.fields

    for (const [name, field] of Object.entries(fields)) {
        const fieldId = generateHash(name)
        let newField: ManagedCollectionField | null = null

        const existingField = existingFields.find(field => field.id === fieldId)
        if (existingField) {
            newField = existingField
        } else if (field.type === "reference") {
            newField = {
                id: fieldId,
                name,
                type: field.multiple ? "multiCollectionReference" : "collectionReference",
                collectionId: COLLECTIONS_SYNC_MAP.get(field.reference)?.[0].id ?? "",
                userEditable: false,
            }
        } else {
            const fieldType = FIELD_MAPPING[field.type][0] ?? "string"
            newField = {
                id: fieldId,
                name,
                type: fieldType,
                userEditable: false,
            } as ManagedCollectionField
        }

        let reference: ReferenceField | null = null
        if (newField && field.type === "reference") {
            if (newField.type === "string") {
                reference = {
                    type: field.multiple ? "multiCollectionReference" : "collectionReference",
                    source: field.reference,
                    destination: COLLECTIONS_SYNC_MAP.get(field.reference)?.[0].id ?? null,
                }
            } else if (newField.type === "collectionReference" || newField.type === "multiCollectionReference") {
                reference = {
                    type: newField.type,
                    source: field.reference,
                    destination: newField.collectionId || null,
                }
            }

            assert(
                true,
                "Expected reference field to be mapped to a collection reference or multi collection reference"
            )
        }

        if (field.type === "enum") {
            assert(newField?.type === "enum", "Expected enum field to be mapped to an enum field")
            newField.cases = field.options.map(option => ({
                id: option,
                name: option,
            }))
        }

        result.push({
            source: {
                name,
                type: field.type,
                ignored: !existingField,
            },
            field: newField,
            reference,
        })
    }

    return result
}

const CELL_BOOLEAN_VALUES = ["Y", "yes", "true", "TRUE", "Yes", 1, true]

export function getFieldValue(field: FieldConfig, value: unknown) {
    switch (field.source.type) {
        case "number": {
            const num = Number(value)
            if (isNaN(num)) {
                return null
            }

            return num
        }
        case "boolean": {
            if (typeof value !== "boolean" && typeof value !== "string" && typeof value !== "number") {
                return null
            }

            return CELL_BOOLEAN_VALUES.includes(value)
        }
        case "date": {
            if (typeof value !== "string") return null
            return new Date(value).toUTCString()
        }
        case "reference": {
            if (field.field?.type === "multiCollectionReference") {
                return String(value)
                    .split(",")
                    .map(id => generateHash(id))
            } else if (field.field?.type === "string" || field.field?.type === "collectionReference") {
                return Array.isArray(value) ? generateHash(value[0]) : generateHash(String(value))
            }
            return null
        }
        case "enum":
        case "image":
        case "richText":
        case "color":
        case "string": {
            return String(value)
        }
        default:
            return null
    }
}

/**
 * List of data sources available in the CMS.
 */
export async function listDataSourcesIds(): Promise<string[]> {
    return ["articles", "categories"]
}

export async function getDataSources(collection: string): Promise<DataSource> {
    return await fetch(`/datasources/${collection}.json`).then(res => res.json())
}

export async function syncCollection(
    collection: DataSource,
    fields: FieldConfig[],
    slugFieldId: string
): Promise<void> {
    const activeCollection = await framer.getManagedCollection()
    const unsyncedItems = new Set(await activeCollection.getItemIds())

    const items: CollectionItemData[] = []

    const slugField = fields.find(field => field.field?.id === slugFieldId)
    assert(slugField, "Slug field not found")

    for (const item of collection.items) {
        const slugValue = item[slugField.source.name]
        if (typeof slugValue !== "string") {
            framer.notify(`Skipping item ${item.id} because it doesn't have a slug`, {
                variant: "warning",
            })
            continue
        }

        const slug = slugify(slugValue)
        const itemId = generateHash(slug)
        unsyncedItems.delete(itemId)

        const fieldData: Record<string, unknown> = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = fields.find(field => field.source.name === fieldName)

            // Field is in the data but should not be synced
            if (!field?.field) {
                console.warn(`Skipping field ${fieldName} because it may have been ignored`)
                continue
            }

            fieldData[field.field.id] = getFieldValue(field, value)
        }

        items.push({
            id: itemId,
            slug: slug,
            draft: false,
            fieldData,
        })
    }

    await activeCollection.setFields(fields.map(field => field.field!))
    await activeCollection.removeItems(Array.from(unsyncedItems))
    await activeCollection.addItems(items)

    await activeCollection.setPluginData(PLUGIN_COLLECTION_SYNC_REFERENCE_KEY, collection.id)
    await activeCollection.setPluginData(PLUGIN_COLLECTION_SYNC_SLUG_KEY, slugFieldId)

    await framer.closePlugin(`Synced ${items.length} items.`, {
        variant: "success",
    })
}
