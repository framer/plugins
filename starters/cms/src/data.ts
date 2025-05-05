import {
    type ManagedCollectionFieldInput,
    type FieldDataInput,
    framer,
    type ManagedCollection,
    type ManagedCollectionItemInput,
} from "framer-plugin"

export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
} as const

export interface DataSource {
    id: string
    fields: readonly ManagedCollectionFieldInput[]
    items: FieldDataInput[]
    idField: ManagedCollectionFieldInput | null // to be used as id field
    slugField: ManagedCollectionFieldInput | null // to be used as slug field
}

export const dataSourceOptions = [
    { id: "articles", name: "Articles", idFieldId: "Id", slugFieldId: "Title" },
    { id: "categories", name: "Categories", idFieldId: "Id", slugFieldId: "Title" },
] as const

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

type ExtendedManagedCollection = ManagedCollection & {
    dataSourceId: string | null
}

let collections: ManagedCollection[] = []
let collectionsWithDataSourceId: ExtendedManagedCollection[] = []

if (framer.mode === "syncManagedCollection" || framer.mode === "configureManagedCollection") {
    collections = await framer.getManagedCollections()
    collectionsWithDataSourceId = await Promise.all(
        collections.map(async collection => {
            const dataSourceId = await collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
            return { ...collection, dataSourceId } as ExtendedManagedCollection
        })
    )
}

const slugs = new Map<string, number>()

function slugify(text: string) {
    text = text.trim()
    text = text.slice(0, 60) // limit to 60 characters

    if (slugs.has(text)) {
        const count = slugs.get(text) ?? 0
        slugs.set(text, count + 1)
        text = `${text} ${count + 1}`
    } else {
        slugs.set(text, 0)
    }

    const slug = text
        .replace(/^\s+|\s+$/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/-+/g, "-")
    return slug
}

export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    // Fetch from your data source
    const dataSourceResponse = await fetch(`/data/${dataSourceId}.json`, { signal: abortSignal })
    const dataSource = await dataSourceResponse.json()

    // Map your source fields to supported field types in Framer
    const fields: ManagedCollectionFieldInput[] = []
    for (const field of dataSource.fields) {
        if (field.type === "multiCollectionReference" || field.type === "collectionReference") {
            if (!field.dataSourceId) {
                console.warn(`No data source id found for collection reference field"${field.name}".`)
            } else {
                const collection = collectionsWithDataSourceId.find(
                    collection => collection.dataSourceId === field.dataSourceId
                )

                if (!collection) {
                    console.warn(`No collection found for data source "${field.dataSourceId}".`)
                } else {
                    field.collectionId = collection.id
                }
            }
        }

        switch (field.type) {
            case "string":
            case "number":
            case "boolean":
            case "color":
            case "formattedText":
            case "date":
            case "link":
            case "collectionReference":
            case "multiCollectionReference":
                fields.push({
                    id: field.name,
                    name: field.name,
                    type: field.type,
                    ...(field.collectionId && { collectionId: field.collectionId }),
                })
                break
            case "image":
            case "file":
            case "enum":
                console.warn(`Support for field type "${field.type}" is not implemented in this Plugin.`)
                break
            default: {
                console.warn(`Unknown field type "${field.type}".`)
            }
        }
    }

    const items = dataSource.items as FieldDataInput[]

    const dataSourceOption = dataSourceOptions.find(option => option.id === dataSourceId)

    const idField = fields.find(field => field.id === dataSourceOption?.idFieldId) ?? null
    const slugField = fields.find(field => field.id === dataSourceOption?.slugFieldId) ?? null

    return {
        id: dataSource.id,
        idField,
        slugField,
        fields,
        items,
    }
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly ManagedCollectionFieldInput[],
    existingFields: readonly ManagedCollectionFieldInput[]
): ManagedCollectionFieldInput[] {
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

        const idValue = item[dataSource.idField?.id ?? ""]
        if (!idValue || typeof idValue.value !== "string") {
            console.warn(`Skipping item at index ${i} because it doesn't have a valid id`)
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
            id: idValue.value,
            slug: slugify(slugValue.value),
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

        await syncCollection(
            collection,
            dataSource,
            existingFields as ManagedCollectionFieldInput[],
            slugField as ManagedCollectionFieldInput
        )
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
