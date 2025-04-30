import {
    type EditableManagedCollectionField,
    type FieldDataInput,
    framer,
    type ManagedCollection,
    type ManagedCollectionItemInput,
} from "framer-plugin"
import pkg from "../package.json"
export const PLUGIN_KEYS = {
    DATA_SOURCE_ID: "dataSourceId",
    SLUG_FIELD_ID: "slugFieldId",
    ID_FIELD_ID: "idFieldId",
    SPACE_ID: `${pkg.name}:spaceId`,
} as const

export type ExtendedEditableManagedCollectionField = EditableManagedCollectionField & {
    dataSourceId?: string
    map?: (value: any) => any
    isMissingReference?: boolean
}

export interface DataSource {
    id: string
    fields: readonly ExtendedEditableManagedCollectionField[]
    items: FieldDataInput[]
    idField: EditableManagedCollectionField | null
    slugField: EditableManagedCollectionField | null
}

export interface GreenhouseDataSource extends DataSource {
    apiEndpoint: string
    itemsKey: string
    fields: readonly ExtendedEditableManagedCollectionField[]
}

function getApiEndpoint(spaceId: string, dataSourceId: string) {
    return `https://boards-api.greenhouse.io/v1/boards/${spaceId}/${dataSourceId}`
}

function decodeHtml(html: string) {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

const slugs = new Map<string, number>()

function slugify(text: string) {
    text = text.trim()

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

const collections = await framer.getManagedCollections()
const collectionsWithDataSourceId = await Promise.all(
    collections.map(async collection => {
        const dataSourceId = await collection.getPluginData(PLUGIN_KEYS.DATA_SOURCE_ID)
        return { ...collection, dataSourceId }
    })
)

console.log("collectionsWithDataSourceId", collectionsWithDataSourceId)

export const dataSourceOptions = [
    {
        id: "jobs",
        name: "Jobs",
        idFieldId: "id", // to be used as the id of the collection item (required)
        slugFieldId: "title", // to be used as the default slug of the collection item
        apiEndpoint: "jobs?content=true",
        itemsKey: "jobs",
        fields: [
            {
                id: "internal_job_id",
                name: "Internal Job ID",
                type: "string",
            },
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "title",
                name: "Title",
                type: "string",
            },
            {
                id: "updated_at",
                name: "Updated At",
                type: "date",
            },
            {
                id: "requisition_id",
                name: "Requisition ID",
                type: "string",
            },
            {
                id: "location",
                name: "Location",
                type: "string",
                map: (value: { name: string }) => value?.name,
            },
            {
                id: "absolute_url",
                name: "Absolute URL",
                type: "link",
            },
            {
                id: "company_name",
                name: "Company Name",
                type: "string",
            },
            {
                id: "first_published",
                name: "First Published",
                type: "date",
            },
            {
                id: "offices",
                name: "Offices",
                type: "multiCollectionReference",
                dataSourceId: "offices",
                map: (value: { id: string }) => value?.id,
            },
            {
                id: "departments",
                name: "Departments",
                type: "multiCollectionReference",
                dataSourceId: "departments",
                map: (value: { id: string }) => value?.id,
            },
            {
                id: "content",
                name: "Content",
                type: "formattedText",
            },
        ],
    },
    {
        id: "departments",
        name: "Departments",
        idFieldId: "id",
        slugFieldId: "name",
        apiEndpoint: "departments",
        itemsKey: "departments",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "name",
                name: "Name",
                type: "string",
            },
            {
                id: "jobs",
                name: "Jobs",
                type: "multiCollectionReference",
                dataSourceId: "jobs",
                map: (value: { id: string }) => value?.id,
            },
        ],
    },
    {
        id: "offices",
        name: "Offices",
        idFieldId: "id",
        slugFieldId: "name",
        apiEndpoint: "offices",
        itemsKey: "offices",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "name",
                name: "Name",
                type: "string",
            },
            {
                id: "location",
                name: "Location",
                type: "string",
            },
            {
                id: "departments",
                name: "Departments",
                type: "multiCollectionReference",
                dataSourceId: "departments",
                map: (value: { id: string }) => value?.id,
            },
        ],
    },
    {
        id: "degrees",
        name: "Degrees",
        idFieldId: "id",
        slugFieldId: "text",
        apiEndpoint: "education/degrees",
        itemsKey: "items",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "text",
                name: "Text",
                type: "string",
            },
        ],
    },
    {
        id: "disciplines",
        name: "Disciplines",
        idFieldId: "id",
        slugFieldId: "text",
        apiEndpoint: "education/disciplines",
        itemsKey: "items",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "text",
                name: "Text",
                type: "string",
            },
        ],
    },
    {
        id: "schools",
        name: "Schools",
        idFieldId: "id",
        slugFieldId: "text",
        apiEndpoint: "education/schools",
        itemsKey: "items",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "text",
                name: "Text",
                type: "string",
            },
        ],
    },
    {
        id: "sections",
        name: "Sections",
        idFieldId: "id",
        slugFieldId: "name",
        apiEndpoint: "sections",
        itemsKey: "sections",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
            {
                id: "name",
                name: "Name",
                type: "string",
            },
            {
                id: "jobs",
                name: "Jobs",
                type: "multiCollectionReference",
                dataSourceId: "jobs",
                map: (value: { id: string }) => value?.id,
            },
        ],
    },
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
export async function getDataSource(dataSourceId: string, abortSignal?: AbortSignal): Promise<DataSource> {
    const spaceId = await framer.getPluginData(PLUGIN_KEYS.SPACE_ID)

    if (!spaceId) {
        throw new Error("No space ID found. Please select a space.")
    }

    // Fetch from your data source
    const dataSourceOption = dataSourceOptions.find(option => option.id === dataSourceId)
    const apiEndpoint = dataSourceOption?.apiEndpoint
    const fields = (dataSourceOption?.fields ?? []) as ExtendedEditableManagedCollectionField[]
    const itemsKey = dataSourceOption?.itemsKey ?? "items"

    if (!apiEndpoint) {
        throw new Error(`No API endpoint found for data source “${dataSourceId}”.`)
    }

    console.log("getApiEndpoint", spaceId, apiEndpoint, getApiEndpoint(spaceId, apiEndpoint))

    const dataSourceResponse = await fetch(getApiEndpoint(spaceId, apiEndpoint), { signal: abortSignal })
    const dataSource = await dataSourceResponse.json()
    console.log("dataSource", dataSource)

    let items = dataSource[itemsKey] as FieldDataInput[]

    // items = await Promise.all(
    //     items.map(async item => {

    //         const questions =

    //         return item
    //     })
    // )

    items = items.map(item => {
        return Object.fromEntries(
            Object.entries(item)
                .map(([key, value]) => {
                    const field = fields.find(field => field.id === key)
                    if (!field) {
                        console.warn(`Unknown field "${key}".`)
                        return undefined
                    }

                    if (field.type === "multiCollectionReference") {
                        const collection = collectionsWithDataSourceId.find(
                            collection => collection.dataSourceId === field.dataSourceId
                        )

                        if (!collection) {
                            console.warn(`No collection found for data source "${field.dataSourceId}".`)
                            field.isMissingReference = true
                        }

                        if (Array.isArray(value) && field?.map) {
                            value = value.map(field?.map).map(String)
                        }

                        return [key, { value: value, type: field.type }]
                    }

                    value = field?.map ? field?.map(value) : value

                    switch (field.type) {
                        case "string":
                            return [key, { value: String(value), type: field.type }]
                        case "number":
                            return [key, { value: Number(value), type: field.type }]
                        case "boolean":
                            return [key, { value: Boolean(value), type: field.type }]
                        case "color":
                            return [key, { value: String(value), type: field.type }]
                        case "formattedText":
                            return [key, { value: decodeHtml(String(value)), type: field.type }]
                        case "date":
                            return [key, { value: String(value), type: field.type }]
                        case "link":
                            return [key, { value: String(value), type: field.type }]
                        case "image":
                            return [key, { value: String(value), type: field.type }]
                        case "file":
                            return [key, { value: String(value), type: field.type }]
                        case "enum":
                        case "collectionReference":
                            return [key, { value: String(value), type: field.type }]
                        // case "multiCollectionReference":
                        //     console.log("multiCollectionReference", value)
                        //     return [key, { value: value, type: field.type }]
                        // console.warn(`Support for field type "${field.type}" is not implemented in this Plugin.`)
                        // break
                        default:
                    }
                })
                .filter(entry => entry !== undefined)
        )
    })

    console.log("fields", fields)
    console.log("items", items)

    return {
        id: dataSourceId,
        fields,
        items,
        idField: fields.find(field => field.id === dataSourceOption?.idFieldId) ?? null,
        slugField: fields.find(field => field.id === dataSourceOption?.slugFieldId) ?? null,
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
    fields: readonly ExtendedEditableManagedCollectionField[], // add map and dataSourceId
    slugField: EditableManagedCollectionField
) {
    const sanitizedFields = fields
        .map(field => {
            delete field?.map

            if (field.type === "multiCollectionReference" || field.type === "collectionReference") {
                const collectionId = collectionsWithDataSourceId.find(
                    collection => collection.dataSourceId === field.dataSourceId
                )?.id
                if (collectionId) {
                    field.collectionId = collectionId
                } else {
                    console.warn(`No collection found for data source "${field.dataSourceId}".`)
                    return null
                }
            }

            return {
                ...field,
                name: field.name.trim() || field.id,
            }
        })
        .filter(field => field)

    const items: ManagedCollectionItemInput[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    console.log(dataSource.items)

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

    console.log("sanitizedFields", sanitizedFields)

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
