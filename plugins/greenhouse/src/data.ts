import {
    type FieldDataInput,
    framer,
    type ManagedCollection,
    ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
} from "framer-plugin"
import pkg from "../package.json"
import { createUniqueSlug, findAsync } from "./utils"
import { CollectionReferenceField, sources } from "./data-source/types"

export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
    ID_FIELD_ID: "idFieldId",
    SPACE_ID: `${pkg.name}:spaceId`,
} as const

// export interface DataSource {
//     id: string
//     fields: readonly ManagedCollectionFieldInput[]
//     items: FieldDataInput[]
//     idField: ManagedCollectionFieldInput | null // to be used as id field
//     slugField: ManagedCollectionFieldInput | null // to be used as slug field
// }

// export interface GreenhouseDataSource extends DataSource {
//     apiEndpoint: string
//     itemsKey: string
//     name: string
// }

function getApiEndpoint(spaceId: string, dataSourceId: string) {
    return `https://boards-api.greenhouse.io/v1/boards/${spaceId}/${dataSourceId}`
}

function decodeHtml(html: string) {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

export const dataSourceOptions = sources

// export const dataSourceOptions: GreenhouseDataSource[] = [
//     {
//         id: "jobs",
//         name: "Jobs",
//         idFieldId: "id", // to be used as the id of the collection item (required)
//         slugFieldId: "title", // to be used as the default slug of the collection item
//         apiEndpoint: "jobs?content=true",
//         itemsKey: "jobs",
//         fields: [
//             {
//                 id: "internal_job_id",
//                 name: "Internal Job ID",
//                 type: "string",
//             },
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "title",
//                 name: "Title",
//                 type: "string",
//             },
//             {
//                 id: "updated_at",
//                 name: "Updated At",
//                 type: "date",
//             },
//             {
//                 id: "requisition_id",
//                 name: "Requisition ID",
//                 type: "string",
//             },
//             {
//                 id: "location",
//                 name: "Location",
//                 type: "string",
//                 map: (value: { name: string }) => value?.name,
//             },
//             {
//                 id: "absolute_url",
//                 name: "Absolute URL",
//                 type: "link",
//             },
//             {
//                 id: "company_name",
//                 name: "Company Name",
//                 type: "string",
//             },
//             {
//                 id: "first_published",
//                 name: "First Published",
//                 type: "date",
//             },
//             {
//                 id: "offices",
//                 name: "Offices",
//                 type: "multiCollectionReference",
//                 dataSourceId: "offices",
//                 map: (value: { id: string }) => value?.id,
//             },
//             {
//                 id: "departments",
//                 name: "Departments",
//                 type: "multiCollectionReference",
//                 dataSourceId: "departments",
//                 map: (value: { id: string }) => value?.id,
//             },
//             {
//                 id: "content",
//                 name: "Content",
//                 type: "formattedText",
//             },
//         ],
//     },
//     {
//         id: "departments",
//         name: "Departments",
//         idFieldId: "id",
//         slugFieldId: "name",
//         apiEndpoint: "departments",
//         itemsKey: "departments",
//         fields: [
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "name",
//                 name: "Name",
//                 type: "string",
//             },
//             {
//                 id: "jobs",
//                 name: "Jobs",
//                 type: "multiCollectionReference",
//                 dataSourceId: "jobs",
//                 map: (value: { id: string }) => value?.id,
//             },
//         ],
//     },
//     {
//         id: "offices",
//         name: "Offices",
//         idFieldId: "id",
//         slugFieldId: "name",
//         apiEndpoint: "offices",
//         itemsKey: "offices",
//         fields: [
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "name",
//                 name: "Name",
//                 type: "string",
//             },
//             {
//                 id: "location",
//                 name: "Location",
//                 type: "string",
//             },
//             {
//                 id: "departments",
//                 name: "Departments",
//                 type: "multiCollectionReference",
//                 dataSourceId: "departments",
//                 map: (value: { id: string }) => value?.id,
//             },
//         ],
//     },
//     {
//         id: "degrees",
//         name: "Degrees",
//         idFieldId: "id",
//         slugFieldId: "text",
//         apiEndpoint: "education/degrees",
//         itemsKey: "items",
//         fields: [
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "text",
//                 name: "Text",
//                 type: "string",
//             },
//         ],
//     },
//     {
//         id: "disciplines",
//         name: "Disciplines",
//         idFieldId: "id",
//         slugFieldId: "text",
//         apiEndpoint: "education/disciplines",
//         itemsKey: "items",
//         fields: [
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "text",
//                 name: "Text",
//                 type: "string",
//             },
//         ],
//     },
//     {
//         id: "schools",
//         name: "Schools",
//         idFieldId: "id",
//         slugFieldId: "text",
//         apiEndpoint: "education/schools",
//         itemsKey: "items",
//         fields: [
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "text",
//                 name: "Text",
//                 type: "string",
//             },
//         ],
//     },
//     {
//         id: "sections",
//         name: "Sections",
//         idFieldId: "id",
//         slugFieldId: "name",
//         apiEndpoint: "sections",
//         itemsKey: "sections",
//         fields: [
//             {
//                 id: "id",
//                 name: "id",
//                 type: "string",
//             },
//             {
//                 id: "name",
//                 name: "Name",
//                 type: "string",
//             },
//             {
//                 id: "jobs",
//                 name: "Jobs",
//                 type: "multiCollectionReference",
//                 dataSourceId: "jobs",
//                 map: (value: { id: string }) => value?.id,
//             },
//         ],
//     },
// ] as const

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

export interface DataSource {
    id: string
    fields: readonly ManagedCollectionFieldInput[]
    items: FieldDataInput[]
    idField: ManagedCollectionFieldInput
    slugField: ManagedCollectionFieldInput | null
}

export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    const spaceId = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)

    if (!spaceId) {
        throw new Error("No board ID found. Please select a board.")
    }

    console.log("getDataSource", dataSourceId)

    const dataSource = dataSourceOptions.find(option => option.id === dataSourceId)
    if (!dataSource) {
        throw new Error(`No data source found for id "${dataSourceId}".`)
    }

    const response = await fetch(getApiEndpoint(spaceId, dataSource.apiEndpoint), { signal: abortSignal })
    const data = await response.json()
    console.log("data", data)

    // const items = data[dataSource.itemsKey]
    // console.log("items", items)

    const fields: ManagedCollectionFieldInput[] = []

    for (const field of dataSource.fields) {
        if (field.type === "multiCollectionReference" || field.type === "collectionReference") {
            let collectionId = ""
            // collection exists on the field if it's a multiCollectionReference or collectionReference
            const fieldWithCollection = field as CollectionReferenceField

            if (fieldWithCollection.getCollection()) {
                const collections = await framer.getManagedCollections()
                const collection = await findAsync(collections, async collection => {
                    const dataSourceId = await collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
                    return dataSourceId === fieldWithCollection.getCollection().id
                })

                if (!collection) {
                    console.warn(`No collection found for data source "${fieldWithCollection.getCollection().id}".`)
                } else {
                    collectionId = collection.id
                }
            } else {
                console.warn(`No collection source found for collection reference field"${field.name}".`)
            }

            fields.push({
                id: field.id,
                name: field.name,
                type: field.type,
                collectionId,
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

    console.log("items", data[dataSource.itemsKey])
    console.log({
        id: dataSourceId,
        fields,
        items,
        idField: dataSource.idField,
        slugField: dataSource.slugField,
    })

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
