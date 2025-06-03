import {
    type FieldDataInput,
    framer,
    type ManagedCollection,
    ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
} from "framer-plugin"
import pkg from "../package.json"
import { createUniqueSlug, filterAsync } from "./utils"
import { CollectionReferenceField, dataSources } from "./data-source/types"

export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
    SPACE_ID: `${pkg.name}:spaceId`,
} as const

function getApiEndpoint(spaceId: string, dataSourceId: string) {
    return `https://boards-api.greenhouse.io/v1/boards/${spaceId}/${dataSourceId}`
}

function decodeHtml(html: string) {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

export const dataSourceOptions = dataSources

// this is used in FieldMapping.tsx to display the collections options in the dropdown
export type ExtendedManagedCollectionFieldInput = ManagedCollectionFieldInput & {
    collectionsOptions?: ManagedCollection[]
    slugifiable?: boolean
}

export interface DataSource {
    id: string
    fields: readonly ExtendedManagedCollectionFieldInput[]
    items: FieldDataInput[]
    idField: ManagedCollectionFieldInput
    slugField: ManagedCollectionFieldInput | null
}

export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    const collection = await framer.getActiveManagedCollection()
    const spaceId = await collection.getPluginData(PLUGIN_KEYS.SPACE_ID)

    if (!spaceId) {
        throw new Error("No board ID found. Please select a board.")
    }

    const dataSource = dataSourceOptions.find(option => option.id === dataSourceId)
    if (!dataSource) {
        throw new Error(`No data source found for id "${dataSourceId}".`)
    }

    const response = await fetch(getApiEndpoint(spaceId, dataSource.apiEndpoint), { signal: abortSignal })
    const data = await response.json()

    const fields: ExtendedManagedCollectionFieldInput[] = []

    for (const field of dataSource.fields) {
        if (field.type === "multiCollectionReference" || field.type === "collectionReference") {
            let collectionId = ""
            let matchingCollections: ManagedCollection[] = []
            // collection exists on the field if it's a multiCollectionReference or collectionReference
            const fieldWithCollection = field as CollectionReferenceField

            if (fieldWithCollection.getCollection()) {
                const collections = await framer.getManagedCollections()
                matchingCollections = await filterAsync(collections, async collection => {
                    const collectionSpaceId = await collection.getPluginData(PLUGIN_KEYS.SPACE_ID)
                    const dataSourceId = await collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
                    return dataSourceId === fieldWithCollection.getCollection().id && collectionSpaceId === spaceId
                })

                if (matchingCollections.length === 0) {
                    console.warn(`No collection found for data source "${fieldWithCollection.getCollection().id}".`)
                } else {
                    collectionId = matchingCollections[0].id
                }
            } else {
                console.warn(`No collection source found for collection reference field"${field.name}".`)
            }

            fields.push({
                id: field.id,
                name: field.name,
                type: field.type,
                collectionId,
                collectionsOptions: matchingCollections,
                slugifiable: field.slugifiable,
            })
        } else {
            switch (field.type) {
                case "string":
                case "number":
                case "boolean":
                case "color":
                case "formattedText":
                case "date":
                case "link":
                    fields.push({
                        id: field.id,
                        name: field.name,
                        type: field.type,
                    })
                    break
                case "image":
                case "file":
                case "enum":
                    console.warn(`Support for field type "${field.type}" is not implemented in this Plugin.`)
                    break
                // default: {
                //     console.warn(`Unknown field type "${field.type}".`)
                // }
            }
        }
    }

    const items: FieldDataInput[] = []

    const unknownFields = new Set<string>()
    const warnings = new Set<string>()

    for (const item of data[dataSource.itemsKey]) {
        const itemData: FieldDataInput = {}
        for (const [fieldName, rawValue] of Object.entries(item)) {
            const field = dataSource.fields.find(field => field.id === fieldName)

            if (field) {
                let value = rawValue

                if (field.map) {
                    value = field.map(value)
                }

                switch (field.type) {
                    case "string":
                        itemData[field.id] = { value: String(value), type: field.type }
                        break
                    case "number":
                        itemData[field.id] = { value: Number(value), type: field.type }
                        break
                    case "boolean":
                        itemData[field.id] = { value: Boolean(value), type: field.type }
                        break
                    case "color":
                        itemData[field.id] = { value: String(value), type: field.type }
                        break
                    case "formattedText":
                        itemData[field.id] = { value: decodeHtml(String(value)), type: field.type }
                        break
                    case "date":
                        itemData[field.id] = { value: String(value), type: field.type }
                        break
                    case "link":
                        itemData[field.id] = { value: String(value), type: field.type }
                        break
                    case "multiCollectionReference":
                        if (Array.isArray(value) && value.every(item => typeof item === "string")) {
                            itemData[field.id] = { value, type: field.type }
                        } else {
                            warnings.add(
                                `Expected array of strings for multiCollectionReference field "${field.name}".`
                            )
                        }
                        break
                    case "collectionReference":
                        if (typeof value === "string") {
                            itemData[field.id] = { value, type: field.type }
                        } else {
                            warnings.add(`Expected string for collectionReference field "${field.name}".`)
                        }
                        break
                }
            } else {
                unknownFields.add(fieldName)
            }
        }
        items.push(itemData)
    }

    if (unknownFields.size > 0) {
        console.warn(`Unknown fields: ${Array.from(unknownFields).join(", ")}.`)
    }

    if (warnings.size > 0) {
        for (const warning of warnings) {
            console.warn(warning)
        }
    }

    let idField: ManagedCollectionFieldInput
    let slugField: ManagedCollectionFieldInput | null = null

    if (dataSource.idField.type === "string") {
        idField = {
            id: dataSource.idField.id,
            name: dataSource.idField.name,
            type: dataSource.idField.type,
        }
    } else {
        throw new Error(`ID field type "${dataSource.idField.type}" is not supported.`)
    }

    if (dataSource.slugField?.type === "string") {
        slugField = {
            id: dataSource.slugField.id,
            name: dataSource.slugField.name,
            type: dataSource.slugField.type,
        }
    }

    return {
        id: dataSourceId,
        fields,
        items,
        idField,
        slugField,
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

    const existingSlugs = new Map<string, number>()

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
            slug: createUniqueSlug(slugValue.value, existingSlugs),
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

        const fields: ManagedCollectionFieldInput[] = []
        for (const field of existingFields) {
            if (field.type === "multiCollectionReference" || field.type === "collectionReference") {
                fields.push({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    collectionId: field.collectionId,
                })
            } else if (field.type === "enum") {
                fields.push({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    cases: field.cases.map(c => ({
                        id: c.id,
                        name: c.name,
                    })),
                })
            } else if (field.type === "file") {
                fields.push({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    allowedFileTypes: field.allowedFileTypes,
                })
            } else {
                fields.push({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                })
            }
        }

        await syncCollection(collection, dataSource, fields, slugField)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection “${previousDataSourceId}”. Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
