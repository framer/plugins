import type {
    ArrayItemInput,
    FieldDataEntryInput,
    FieldDataInput,
    ManagedCollection,
    ManagedCollectionField,
    ManagedCollectionItemInput,
    ProtectedMethod,
} from "framer-plugin"
import { framer } from "framer-plugin"
import * as v from "valibot"
import {
    type AirtableFieldSchema,
    fetchAllBases,
    fetchRecords,
    fetchTable,
    fetchTables,
    isAiTextValue,
    isBarcodeValue,
    isCollaboratorValue,
} from "./api"
import type { PossibleField } from "./fields"
import { inferFields } from "./fields"
import { assert, richTextToHTML } from "./utils"

export const PLUGIN_KEYS = {
    BASE_ID: "airtablePluginBaseId",
    TABLE_ID: "airtablePluginTableId",
    TABLE_NAME: "airtablePluginTableName",
    SLUG_FIELD_ID: "airtablePluginSlugId",
} as const

const IMAGE_FILE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/apng", "image/webp", "image/svg+xml"]

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

const EMAIL_REGEX = /\S[^\s@]*@\S+\.\S+/
const PHONE_REGEX = /^(\+?[0-9])[0-9]{7,14}$/

const NonEmptyArrayOfAttachmentsSchema = v.pipe(
    v.array(v.object({ type: v.optional(v.string()), id: v.string(), url: v.string() })),
    v.minLength(1)
)

const ArrayOfStringsSchema = v.array(v.string())
const NonEmptyArrayOfStringsSchema = v.pipe(ArrayOfStringsSchema, v.minLength(1))

function getFieldDataEntryForFieldSchema(fieldSchema: PossibleField, value: unknown): FieldDataEntryInput | null {
    // If the field is a lookup field, only use the first value from the array.
    if (fieldSchema.originalAirtableType === "multipleLookupValues") {
        if (!Array.isArray(value)) return null
        if (value.length === 0) return null
        value = value[0]
    }

    switch (fieldSchema.type) {
        case "boolean":
            return {
                value: Boolean(value),
                type: "boolean",
            }

        case "link":
        case "image":
        case "file": {
            if (typeof value === "string") {
                if (fieldSchema.airtableType === "email" || EMAIL_REGEX.test(value)) {
                    return {
                        value: `mailto:${value}`,
                        type: "link",
                    }
                }

                if (fieldSchema.airtableType === "phoneNumber" || PHONE_REGEX.test(value)) {
                    return {
                        value: `tel:${value}`,
                        type: "link",
                    }
                }

                return {
                    value,
                    type: fieldSchema.type,
                }
            }

            if (!v.is(NonEmptyArrayOfAttachmentsSchema, value)) return null

            let selectedItem = value[0]
            assert(selectedItem !== undefined)

            // For image fields, find the first image file in the array
            if (fieldSchema.type === "image") {
                const imageItem = value.find(item => !item.type || IMAGE_FILE_MIME_TYPES.includes(item.type))
                if (!imageItem) return null

                selectedItem = imageItem
            }

            return {
                value: selectedItem.url,
                type: fieldSchema.type,
            }
        }

        case "collectionReference": {
            if (!v.is(NonEmptyArrayOfStringsSchema, value)) return null
            const firstItem = value[0]
            assert(firstItem !== undefined)
            return {
                value: firstItem,
                type: "collectionReference",
            }
        }

        case "multiCollectionReference":
            if (!v.is(ArrayOfStringsSchema, value)) return null
            return {
                value,
                type: "multiCollectionReference",
            }

        case "date":
            if (typeof value === "string") {
                const date = new Date(value)
                if (Number.isNaN(date.getTime())) return null
                return {
                    value: date.toISOString(),
                    type: "date",
                }
            }
            return null

        case "string":
            switch (fieldSchema.airtableType) {
                case "barcode": {
                    if (!isBarcodeValue(value)) return null
                    return {
                        value: value.text,
                        type: "string",
                    }
                }
                case "aiText": {
                    if (!isAiTextValue(value)) return null
                    return {
                        value: value.value ?? "",
                        type: "string",
                    }
                }
                case "duration": {
                    if (typeof value !== "number" || Number.isNaN(value)) return null

                    const hours = Math.floor(value / 3600)
                    const minutes = Math.floor((value % 3600) / 60)
                    const remainingSeconds = value % 60
                    const seconds = Math.floor(remainingSeconds).toString().padStart(2, "0")

                    let result = ""
                    result += hours.toString()
                    result += ":" + minutes.toString().padStart(2, "0")

                    // Handle seconds and milliseconds based on format
                    const durationOptions = fieldSchema.airtableOptions as { durationFormat?: string } | undefined
                    switch (durationOptions?.durationFormat) {
                        case "h:mm":
                            break
                        case "h:mm:ss":
                            result += ":" + seconds
                            break
                        case "h:mm:ss.S":
                            result += ":" + seconds
                            result += "." + (remainingSeconds % 1).toFixed(1).substring(2)
                            break
                        case "h:mm:ss.SS":
                            result += ":" + seconds
                            result += "." + (remainingSeconds % 1).toFixed(2).substring(2)
                            break
                        case "h:mm:ss.SSS":
                            result += ":" + seconds
                            result += "." + (remainingSeconds % 1).toFixed(3).substring(2)
                            break
                    }

                    return {
                        value: result,
                        type: "string",
                    }
                }
                case "singleCollaborator":
                case "createdBy":
                case "lastModifiedBy": {
                    if (!isCollaboratorValue(value)) return null
                    return {
                        value: value.name,
                        type: "string",
                    }
                }
            }

            if (typeof value !== "string") return null
            return {
                value,
                type: "string",
            }

        case "color":
            if (!value || typeof value !== "string") return null
            return {
                value,
                type: "color",
            }

        case "formattedText":
            if (typeof value !== "string") return null
            return {
                value: richTextToHTML(value),
                type: "formattedText",
            }

        case "enum": {
            if (typeof value !== "string") return null
            const choice = fieldSchema.cases.find(choice => choice.name === value)
            if (!choice) return null
            return {
                value: choice.id,
                type: "enum",
            }
        }

        case "number":
            if (typeof value !== "number" || Number.isNaN(value)) return null
            return {
                value,
                type: "number",
            }

        case "array": {
            if (!v.is(NonEmptyArrayOfAttachmentsSchema, value)) return null

            const imageField = fieldSchema.fields[0]
            const arrayItems: ArrayItemInput[] = []

            for (const item of value) {
                // Filter out non-image files
                if (item.type && !IMAGE_FILE_MIME_TYPES.includes(item.type)) {
                    continue
                }

                arrayItems.push({
                    id: item.id,
                    fieldData: {
                        [imageField.id]: {
                            value: item.url,
                            type: "image",
                        },
                    },
                })
            }

            return {
                value: arrayItems,
                type: fieldSchema.type,
            }
        }

        default:
            return null
    }
}

export async function getItems(dataSource: DataSource, slugFieldId: string) {
    const items = await fetchRecords(dataSource.baseId, dataSource.tableId)
    const fieldsById = new Map(dataSource.fields.map(field => [field.id, field]))
    const itemsData: { id: string; slugValue: string; fieldData: FieldDataInput }[] = []

    for (const item of items) {
        const fieldData: FieldDataInput = {}

        for (const fieldSchema of dataSource.fields) {
            const cellValue = item.fields[fieldSchema.id]
            if (cellValue !== undefined) {
                const field = fieldsById.get(fieldSchema.id)
                if (!field) continue

                const fieldDataEntry = getFieldDataEntryForFieldSchema(fieldSchema, cellValue)
                if (!fieldDataEntry) continue

                fieldData[fieldSchema.id] = fieldDataEntry
            }
        }

        let slugField = fieldData[slugFieldId]
        if (!slugField) {
            const fieldDataEntry = getFieldDataEntryForFieldSchema(
                {
                    type: "string",
                    id: slugFieldId,
                    name: "slug",
                    userEditable: false,
                },
                item.fields[slugFieldId]
            )

            if (!fieldDataEntry) {
                console.warn(`Skipping item “${item.id}” because slug field “${slugFieldId}” is not present.`)
                continue
            }

            slugField = fieldDataEntry
        }

        // Check for missing fields and set default values.
        // TODO: In Plugin 4.0, unset fields will be removed, this will no longer be needed.
        for (const field of dataSource.fields) {
            if (!fieldData[field.id]) {
                switch (field.type) {
                    case "string":
                    case "formattedText":
                        fieldData[field.id] = {
                            value: "",
                            type: field.type,
                        }
                        break
                    case "enum": {
                        const firstCase = field.cases[0]
                        if (!firstCase) {
                            console.warn(`Skipping item “${item.id}” because enum field “${field.name}” has no cases.`)
                            continue
                        }
                        fieldData[field.id] = {
                            value: firstCase.id,
                            type: "enum",
                        }
                        break
                    }
                    case "boolean":
                        fieldData[field.id] = {
                            value: false,
                            type: "boolean",
                        }
                        break
                    case "number":
                        fieldData[field.id] = {
                            value: 0,
                            type: "number",
                        }
                        break
                    case "image":
                    case "file":
                    case "link":
                    case "date":
                    case "color":
                    case "collectionReference":
                    case "multiCollectionReference":
                        fieldData[field.id] = {
                            value: null,
                            type: field.type,
                        }
                        break
                    case "array":
                        fieldData[field.id] = {
                            value: [],
                            type: "array",
                        }
                        break
                    default:
                        console.warn(
                            `Missing value for field “${field.name}” on item “${item.id}”, it will be set to the default value for its type.`
                        )
                        break
                }
            }
        }

        itemsData.push({ id: item.id, slugValue: slugField.value as string, fieldData })
    }

    return itemsData
}

export interface DataSource {
    baseId: string
    tableId: string
    tableName: string
    fields: readonly PossibleField[]
}

export function mergeFieldsWithExistingFields(
    sourceFields: readonly PossibleField[],
    existingFields: readonly ManagedCollectionField[]
): PossibleField[] {
    return sourceFields.map(sourceField => {
        const existingField = existingFields.find(existingField => existingField.id === sourceField.id)
        if (existingField) {
            const field = {
                ...sourceField,
                type: existingField.type,
                name: existingField.name,
            } as PossibleField

            switch (existingField.type) {
                case "collectionReference":
                case "multiCollectionReference":
                    return {
                        ...field,
                        collectionId: existingField.collectionId,
                    }
                case "file":
                    return {
                        ...field,
                        allowedFileTypes: existingField.allowedFileTypes,
                    }
                case "array":
                    return {
                        ...field,
                        fields: existingField.fields,
                    }
                default:
                    return field
            }
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
    const dataSourceItems = await getItems({ ...dataSource, fields }, slugFieldId)
    const items: ManagedCollectionItemInput[] = []
    const unsyncedItems = new Set(await collection.getItemIds())

    for (const item of dataSourceItems) {
        items.push({
            id: item.id,
            slug: item.slugValue,
            draft: false,
            fieldData: item.fieldData,
        })

        unsyncedItems.delete(item.id)
    }

    await collection.removeItems(Array.from(unsyncedItems))
    await collection.addItems(items)

    await Promise.all([
        collection.setPluginData(PLUGIN_KEYS.BASE_ID, dataSource.baseId),
        collection.setPluginData(PLUGIN_KEYS.TABLE_ID, dataSource.tableId),
        collection.setPluginData(PLUGIN_KEYS.TABLE_NAME, dataSource.tableName),
        collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugFieldId),
    ])
}

export const syncMethods = [
    "ManagedCollection.removeItems",
    "ManagedCollection.addItems",
    "ManagedCollection.setPluginData",
] as const satisfies ProtectedMethod[]

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

    if (!framer.isAllowedTo(...syncMethods)) {
        return { didSync: false }
    }

    try {
        await framer.hideUI()

        const existingFields = await collection.getFields()
        const table = await fetchTable(previousBaseId, previousTableId)
        if (!table) {
            throw new Error(`Table “${previousTableName ?? "NULL"}” not found`)
        }

        // Use properly inferred fields instead of existing collection fields
        const inferredFields = await inferFields(collection, table)

        // Filter fields to match the format expected by syncCollection
        const fieldsToSync = inferredFields.filter(field => {
            // Only include fields that exist in the current collection
            const existsInCollection = existingFields.some(existingField => existingField.id === field.id)

            // Exclude unsupported fields
            const isSupportedType = field.type !== "unsupported"

            // For collection references, ensure collectionId is not empty
            const isValidCollectionReference =
                (field.type !== "collectionReference" && field.type !== "multiCollectionReference") ||
                field.collectionId !== ""

            return existsInCollection && isSupportedType && isValidCollectionReference
        })

        const dataSource: DataSource = {
            baseId: previousBaseId,
            tableId: previousTableId,
            tableName: table.name,
            fields: inferredFields,
        }
        await syncCollection(collection, dataSource, fieldsToSync, previousSlugFieldId)
        return { didSync: true }
    } catch (error) {
        console.error(error)
        framer.notify(
            `Failed to sync collection “${previousTableName ?? "NULL"}”. Check browser console for more details.`,
            { variant: "error" }
        )
        return { didSync: false }
    }
}
