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
    SPACE_ID: `${pkg.name}:spaceId`,
} as const

export interface DataSource {
    id: string
    fields: readonly EditableManagedCollectionField[]
    items: FieldDataInput[]
}

export interface GreenhouseDataSource extends DataSource {
    apiEndpoint: string
    itemsKey: string
    fields: readonly EditableManagedCollectionField[]
}

function getApiEndpoint(spaceId: string, dataSourceId: string) {
    return `https://boards-api.greenhouse.io/v1/boards/${spaceId}/${dataSourceId}`
}

function decodeHtml(html: string) {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

export const dataSourceOptions = [
    {
        id: "jobs",
        name: "Jobs",
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
                id: "content",
                name: "Content",
                type: "formattedText",
            },
            {
                id: "first_published",
                name: "First Published",
                type: "date",
            },
            // {
            //     id: "departments",
            //     name: "Departments",
            //     type: "multiCollectionReference",
            //     // collectionId: "departments",
            // },
            // {
            //     id: "offices",
            //     name: "Offices",
            //     type: "multiCollectionReference",
            //     // collectionId: "offices",
            // },
        ],
    },
    {
        id: "departments",
        name: "Departments",
        apiEndpoint: "departments",
        itemsKey: "departments",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
        ],
    },
    {
        id: "offices",
        name: "Offices",
        apiEndpoint: "offices",
        itemsKey: "offices",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
        ],
    },
    {
        id: "degrees",
        name: "Degrees",
        apiEndpoint: "degrees",
        itemsKey: "degrees",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
        ],
    },
    {
        id: "disciplines",
        name: "Discipline",
        apiEndpoint: "disciplines",
        itemsKey: "disciplines",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
        ],
    },
    {
        id: "schools",
        name: "Schools",
        apiEndpoint: "schools",
        itemsKey: "schools",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
            },
        ],
    },
    {
        id: "sections",
        name: "Sections",
        apiEndpoint: "sections",
        itemsKey: "sections",
        fields: [
            {
                id: "id",
                name: "id",
                type: "string",
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

    const keys = await framer.getPluginDataKeys()
    console.log("keys", keys)

    if (!spaceId) {
        throw new Error("No space ID found. Please select a space.")
    }

    // Fetch from your data source
    const dataSourceOption = dataSourceOptions.find(option => option.id === dataSourceId)
    const apiEndpoint = dataSourceOption?.apiEndpoint
    const fields = (dataSourceOption?.fields ?? []) as EditableManagedCollectionField[]
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

                    // @ts-expect-error map is not typed
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
                        case "multiCollectionReference":
                            console.warn(`Support for field type "${field.type}" is not implemented in this Plugin.`)
                            break
                        default:
                    }
                })
                .filter(entry => entry !== undefined)
        )
    })

    console.log(items)

    return {
        id: dataSourceId,
        fields,
        items,
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
    fields: readonly EditableManagedCollectionField[],
    slugField: EditableManagedCollectionField
) {
    const sanitizedFields = fields.map(field => {
        // @ts-expect-error map is not typed
        delete field?.map

        return {
            ...field,
            name: field.name.trim() || field.id,
        }
    })

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
            id: slugValue.value,
            slug: slugValue.value,
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
