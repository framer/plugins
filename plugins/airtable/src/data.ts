import type {
    CollectionItemData,
    ManagedCollection,
    CollectionField,
    ManagedCollectionItemInput,
    ManagedCollectionField,
} from "framer-plugin"

import { framer } from "framer-plugin"
import { type AirtableFieldSchema, fetchAllBases, fetchRecords, fetchTable, fetchTables } from "./api"
import { ALLOWED_FILE_TYPES, richTextToHTML } from "./utils"

export const PLUGIN_KEYS = {
    BASE_ID: "airtablePluginBaseId",
    TABLE_ID: "airtablePluginTableId",
    TABLE_NAME: "airtablePluginTableName",
    SLUG_FIELD_ID: "airtablePluginSlugId",
} as const

export interface AirtableBase {
    id: string
    name: string
}

export interface AirtableTable {
    id: string
    name: string
    fields: readonly AirtableFieldSchema[]
}

export async function getUserBases(): Promise<AirtableBase[]> {
    return fetchAllBases().then(bases =>
        bases.map(base => ({
            id: base.id,
            name: base.name,
        }))
    )
}

export async function getTables(baseId: string, signal: AbortSignal): Promise<AirtableTable[]> {
    return fetchTables(baseId, signal).then(baseSchema =>
        baseSchema.tables.map(tableSchema => ({
            id: tableSchema.id,
            name: tableSchema.name,
            fields: tableSchema.fields,
        }))
    )
}

interface InferredField {
    /**
     * The type of the field as it appears in Airtable.
     *
     * Only set when fields are inferred.
     */
    readonly airtableType?: Exclude<AirtableFieldSchema["type"], "multipleRecordLinks" | "singleSelect">
    readonly allowedTypes?: [CollectionField["type"], ...CollectionField["type"][]]
}

interface InferredMultipleRecordLinksField {
    type: "collectionReference" | "multiCollectionReference"
    readonly airtableType: "multipleRecordLinks"
    readonly single: boolean
    readonly supportedCollections: { id: string; name: string }[]
    readonly allowedTypes?: []
}

interface InferredEnumField {
    type: "enum"
    readonly airtableType: "singleSelect"
    readonly airtableCases: { id: string; name: string }[]
    readonly allowedTypes: ["enum"]
}

export type PossibleField = CollectionField & (InferredField | InferredMultipleRecordLinksField | InferredEnumField)

export async function inferFields(collection: ManagedCollection, table: AirtableTable): Promise<PossibleField[]> {
    const fields: PossibleField[] = []

    for (const fieldSchema of table.fields) {
        const fieldMetadata = {
            id: fieldSchema.id,
            name: fieldSchema.name,
            userEditable: false,
        }

        switch (fieldSchema.type) {
            case "checkbox":
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "boolean",
                    allowedTypes: ["boolean"],
                })
                break

            case "singleSelect":
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "enum",
                    cases: fieldSchema.options.choices.map(choice => ({
                        id: choice.id,
                        name: choice.name,
                    })),
                    airtableCases: fieldSchema.options.choices.map(choice => ({
                        id: choice.id,
                        name: choice.name,
                    })),
                    allowedTypes: ["enum"],
                })
                break

            case "number":
            case "percent":
            case "currency":
            case "autoNumber":
            case "rating":
            case "duration":
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "number",
                    allowedTypes: ["number"],
                })
                break

            case "singleLineText":
            case "email":
            case "phoneNumber":
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "string",
                    allowedTypes: ["string"],
                })
                break

            case "multilineText":
            case "richText":
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "formattedText",
                    allowedTypes: ["formattedText"],
                })
                break

            case "url":
            case "multipleAttachments":
                // Make the file types all possible file types since validation is enforced on Airtable's side
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "file",
                    allowedFileTypes: ALLOWED_FILE_TYPES,
                    allowedTypes: ["file", "image", "link"],
                })
                break

            case "date":
            case "dateTime":
            case "createdTime":
            case "lastModifiedTime":
                fields.push({
                    ...fieldMetadata,
                    airtableType: fieldSchema.type,
                    type: "date",
                    allowedTypes: ["date"],
                })
                break

            case "multipleRecordLinks": {
                let foundCollections: { id: string; name: string }[] = []

                if (table.id === fieldSchema.options.linkedTableId) {
                    foundCollections.push({ id: collection.id, name: "This Collection" })
                } else {
                    const existingCollections = await framer.getManagedCollections()
                    for (const existingCollection of existingCollections) {
                        const tableId = await existingCollection.getPluginData(PLUGIN_KEYS.TABLE_ID)

                        if (tableId === fieldSchema.options.linkedTableId) {
                            foundCollections.push({ id: existingCollection.id, name: existingCollection.name })
                        }
                    }
                }

                const type = fieldSchema.options.prefersSingleRecordLink
                    ? "collectionReference"
                    : "multiCollectionReference"

                // Only add unsupported field if we didn't find a matching collection
                if (foundCollections.length === 0) {
                    fields.push({
                        ...fieldMetadata,
                        airtableType: fieldSchema.type,
                        type,
                        collectionId: "",
                        supportedCollections: [],
                        single: fieldSchema.options.prefersSingleRecordLink,
                    })
                } else {
                    fields.push({
                        ...fieldMetadata,
                        airtableType: "multipleRecordLinks",
                        supportedCollections: foundCollections,
                        collectionId: foundCollections[0].id,
                        type,
                        single: fieldSchema.options.prefersSingleRecordLink,
                    })
                }
                break
            }

            case "formula": {
                const result = fieldSchema.options.result
                if (!result) {
                    fields.push({ ...fieldMetadata, type: "unsupported", allowedTypes: ["unsupported"] })
                    continue
                }

                switch (result.type) {
                    case "singleLineText":
                    case "email":
                    case "url":
                    case "phoneNumber":
                        fields.push({ ...fieldMetadata, type: "string", allowedTypes: ["string"] })
                        break
                    case "checkbox":
                        fields.push({ ...fieldMetadata, type: "boolean", allowedTypes: ["boolean"] })
                        break
                    case "number":
                    case "percent":
                    case "currency":
                    case "autoNumber":
                    case "rating":
                    case "duration":
                        fields.push({ ...fieldMetadata, type: "number", allowedTypes: ["number"] })
                        break
                    case "multipleAttachments":
                        fields.push({
                            ...fieldMetadata,
                            type: "file",
                            allowedFileTypes: ALLOWED_FILE_TYPES,
                            allowedTypes: ["file", "image", "link"],
                        })
                        break
                    case "date":
                    case "dateTime":
                    case "createdTime":
                    case "lastModifiedTime":
                        fields.push({ ...fieldMetadata, type: "date", allowedTypes: ["date"] })
                        break
                    case "richText":
                    case "multilineText":
                        fields.push({ ...fieldMetadata, type: "formattedText", allowedTypes: ["formattedText"] })
                        break
                    default:
                        fields.push({ ...fieldMetadata, type: "unsupported", allowedTypes: ["unsupported"] })
                        continue
                }
                break
            }

            default:
                fields.push({ ...fieldMetadata, type: "unsupported", allowedTypes: ["unsupported"] })
                continue
        }
    }

    return fields
}

function getItemValueForField(fieldSchema: PossibleField, value: unknown): unknown {
    switch (fieldSchema.type) {
        case "boolean":
            return Boolean(value)

        case "link":
        case "image":
        case "file":
            if (typeof value === "string") {
                return value
            }

            if (!Array.isArray(value)) return null
            if (value.length === 0) return null
            // TODO: When we add support for gallery fields, we'll need to return an array of URLs.
            return value[0].url

        case "collectionReference":
            if (!Array.isArray(value)) return null
            if (value.length === 0) return null
            return value[0]

        case "multiCollectionReference":
            if (!Array.isArray(value)) return null
            return value

        case "date":
            if (typeof value === "string") {
                const date = new Date(value)
                return isNaN(date.getTime()) ? null : date.toISOString()
            }
            return null

        case "string":
        case "color":
            return typeof value === "string" ? value : null

        case "formattedText":
            return typeof value === "string" ? richTextToHTML(value) : null

        case "enum":
            if (typeof value !== "string") return null
            const choice = fieldSchema.cases.find(choice => choice.name === value)
            return choice?.id ?? null

        case "number":
            return typeof value === "number" ? value : null

        default:
            return value
    }
}

export async function getItems(dataSource: DataSource, slugFieldId: string) {
    const items = await fetchRecords(dataSource.baseId, dataSource.tableId)
    const fieldsById = new Map(dataSource.fields.map(field => [field.id, field]))
    const itemsData: ({ id: string } & Record<string, unknown>)[] = []

    for (const item of items) {
        const itemData: Record<string, unknown> = {}

        for (const fieldSchema of dataSource.fields) {
            // Set default false for checkbox fields
            if (fieldSchema.type === "boolean") {
                itemData[fieldSchema.id] = false
            }

            const cellValue = item.fields[fieldSchema.id]
            if (cellValue !== undefined) {
                const field = fieldsById.get(fieldSchema.id)
                if (!field) continue

                itemData[fieldSchema.id] = getItemValueForField(fieldSchema, cellValue)
            }
        }

        if (!itemData[slugFieldId]) {
            const slugValue = item.fields[slugFieldId]
            if (slugValue === undefined) {
                console.warn(`Skipping item "${item.id}" because slug field "${slugFieldId}" is not present.`)
                continue
            }

            itemData[slugFieldId] = getItemValueForField(
                {
                    type: "string",
                    id: slugFieldId,
                    name: "slug",
                    allowedTypes: ["string"],
                },
                slugValue
            )
        }

        itemsData.push({ id: item.id, ...itemData })
    }

    return itemsData
}

export interface DataSource {
    baseId: string
    tableId: string
    tableName: string
    fields: PossibleField[]
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly PossibleField[],
    existingFields: readonly ManagedCollectionField[]
): PossibleField[] {
    return sourceFields.map(sourceField => {
        const existingField = existingFields.find(existingField => existingField.id === sourceField.id)
        if (existingField) {
            if (existingField.type === "collectionReference" || existingField.type === "multiCollectionReference") {
                return {
                    ...sourceField,
                    type: existingField.type,
                    name: existingField.name,
                    collectionId: existingField.collectionId,
                } as PossibleField
            }

            return { ...sourceField, type: existingField.type, name: existingField.name } as PossibleField
        }
        return sourceField
    })
}

export async function syncCollection(
    collection: ManagedCollection,
    dataSource: DataSource,
    fields: readonly PossibleField[],
    slugFieldId: string
) {
    const sanitizedFields = fields
        .map(field => ({
            ...field,
            name: field.name.trim() || field.id,
        }))
        .filter(field => field.type !== "divider" && field.type !== "unsupported")
        .filter(
            field =>
                (field.type !== "collectionReference" && field.type !== "multiCollectionReference") ||
                field.collectionId !== ""
        )

    const dataSourceItems = await getItems(
        {
            ...dataSource,
            fields: sanitizedFields,
        },
        slugFieldId
    )
    const items: ManagedCollectionItemInput[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    for (let i = 0; i < dataSourceItems.length; i++) {
        const item = dataSourceItems[i]
        const slugValue = item[slugFieldId]

        if (typeof slugValue !== "string" || !slugValue) {
            console.warn(`Skipping item at index ${i} because it doesn't have a valid slug`)
            continue
        }

        const fieldData: CollectionItemData["fieldData"] = {}
        for (const [fieldName, value] of Object.entries(item)) {
            const field = sanitizedFields.find(field => field.id === fieldName)

            // Field is in the data but skipped based on selected fields.
            if (!field) continue

            // For details on expected field value, see:
            // https://www.framer.com/developers/plugins/cms#collections
            fieldData[field.id] = value
        }

        items.push({
            id: item.id,
            slug: slugValue,
            draft: false,
            fieldData,
        })

        unsyncedItems.delete(item.id)
    }

    await collection.setFields(sanitizedFields)
    await collection.removeItems(Array.from(unsyncedItems))
    await collection.addItems(items)

    await Promise.all([
        collection.setPluginData(PLUGIN_KEYS.BASE_ID, dataSource.baseId),
        collection.setPluginData(PLUGIN_KEYS.TABLE_ID, dataSource.tableId),
        collection.setPluginData(PLUGIN_KEYS.TABLE_NAME, dataSource.tableName),
        collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugFieldId),
    ])
}

export async function syncExistingCollection(
    collection: ManagedCollection,
    previousBaseId: string | null,
    previousTableId: string | null,
    previousTableName: string | null,
    previousSlugFieldId: string | null
): Promise<{ didSync: boolean }> {
    if (!previousBaseId || !previousTableId) {
        return { didSync: false }
    }

    if (framer.mode !== "syncManagedCollection" || !previousSlugFieldId) {
        return { didSync: false }
    }

    try {
        await framer.hideUI()

        const existingFields = await collection.getFields()
        const table = await fetchTable(previousBaseId, previousTableId)
        if (!table) {
            throw new Error(`Table "${previousTableName}" not found`)
        }
        const dataSource: DataSource = {
            baseId: previousBaseId,
            tableId: previousTableId,
            tableName: table.name,
            fields: existingFields,
        }
        await syncCollection(collection, dataSource, existingFields, previousSlugFieldId)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(`Failed to sync collection "${previousTableName}". Check browser console for more details.`, {
            variant: "error",
        })
        return { didSync: false }
    }
}
