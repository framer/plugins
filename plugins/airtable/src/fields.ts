import type { ManagedCollection, ManagedCollectionFieldInput } from "framer-plugin"

import { framer } from "framer-plugin"
import type { AirtableFieldSchema } from "./api"
import { PLUGIN_KEYS } from "./data"
import { ALLOWED_FILE_TYPES } from "./utils"

type AllowedType = ManagedCollectionFieldInput["type"] | "unsupported"

interface InferredField {
    /**
     * The type of the field as it appears in Airtable.
     *
     * Only set when fields are inferred.
     */
    readonly airtableType?: Exclude<AirtableFieldSchema["type"], "multipleRecordLinks" | "singleSelect">
    readonly allowedTypes?: [AllowedType, ...AllowedType[]]
    /**
     * The original Airtable field schema options.
     * Only set when fields are inferred.
     */
    readonly airtableOptions?: AirtableFieldSchema["options"]
}

interface InferredMultipleRecordLinksField {
    type: "collectionReference" | "multiCollectionReference"
    readonly airtableType: "multipleRecordLinks"
    readonly airtableOptions?: AirtableFieldSchema["options"]
    readonly single: boolean
    readonly supportedCollections: { id: string; name: string }[]
    readonly allowedTypes?: []
}

interface InferredEnumField {
    type: "enum"
    readonly airtableType: "singleSelect"
    readonly airtableCases: { id: string; name: string }[]
    readonly airtableOptions?: AirtableFieldSchema["options"]
    readonly allowedTypes: ["enum"]
}

interface InferredUnsupportedField {
    type: "unsupported"
    readonly airtableType?: AirtableFieldSchema["type"]
    readonly airtableOptions?: AirtableFieldSchema["options"]
    readonly allowedTypes: [AirtableFieldSchema["type"], ...AirtableFieldSchema["type"][]]
}

export type PossibleField = (
    | ManagedCollectionFieldInput
    | {
          id: string
          name: string
          userEditable: boolean
          type: "unsupported"
      }
) &
    (InferredField | InferredMultipleRecordLinksField | InferredEnumField | InferredUnsupportedField) & {
        /**
         * The original Airtable field type before any transformations.
         * For lookup fields, this will be "multipleLookupValues".
         */
        readonly originalAirtableType?: string
    }

function inferBooleanField(fieldSchema: AirtableFieldSchema & { type: "checkbox" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "boolean",
        allowedTypes: ["boolean"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferEnumField(fieldSchema: AirtableFieldSchema & { type: "singleSelect" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
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
        originalAirtableType: fieldSchema.type,
    }
}

function inferNumberField(
    fieldSchema: AirtableFieldSchema & {
        type: "number" | "percent" | "currency" | "autoNumber" | "rating"
    }
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "number",
        allowedTypes: ["number"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferDurationField(fieldSchema: AirtableFieldSchema & { type: "duration" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "string",
        allowedTypes: ["string", "number"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferStringField(fieldSchema: AirtableFieldSchema & { type: "singleLineText" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "string",
        allowedTypes: ["string", "formattedText"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferEmailOrPhoneField(fieldSchema: AirtableFieldSchema & { type: "email" | "phoneNumber" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "string",
        allowedTypes: ["string", "link"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferTextField(fieldSchema: AirtableFieldSchema & { type: "multilineText" | "richText" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "formattedText",
        allowedTypes: ["formattedText", "string"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferUrlField(fieldSchema: AirtableFieldSchema & { type: "url" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "link",
        allowedTypes: ["link", "image", "file", "string"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferAttachmentsField(fieldSchema: AirtableFieldSchema & { type: "multipleAttachments" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "image",
        allowedTypes: ["image", "file", "link"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferDateField(
    fieldSchema: AirtableFieldSchema & {
        type: "date" | "dateTime" | "createdTime" | "lastModifiedTime"
    }
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "date",
        allowedTypes: ["date"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferBarcodeField(fieldSchema: AirtableFieldSchema & { type: "barcode" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "string",
        allowedTypes: ["string"],
        originalAirtableType: fieldSchema.type,
    }
}

function inferAiTextField(fieldSchema: AirtableFieldSchema & { type: "aiText" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "string",
        allowedTypes: ["string"],
        originalAirtableType: fieldSchema.type,
    }
}

async function inferLookupField(
    fieldSchema: AirtableFieldSchema & { type: "multipleLookupValues" },
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string
): Promise<PossibleField> {
    const { options } = fieldSchema

    // If the lookup field doesn't have a result type, treat as unsupported
    if (!options.result || typeof options.result !== "object" || !options.result.type) {
        return createUnsupportedField(fieldSchema)
    }

    // Use the result object as the field schema for recursive inference
    const resultSchema = {
        type: options.result.type as AirtableFieldSchema["type"],
        id: fieldSchema.id,
        name: fieldSchema.name,
        options: options.result.options as AirtableFieldSchema["options"],
    } as AirtableFieldSchema

    // Use the helper functions to infer the appropriate type based on the result
    const inferredField = await inferFieldByType(resultSchema, collection, tableIdBeingLinkedTo, 1)

    // Return the inferred field with the lookup field metadata
    return { ...inferredField, originalAirtableType: "multipleLookupValues" } as PossibleField
}

async function inferRollupField(
    fieldSchema: AirtableFieldSchema & { type: "rollup" },
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string
): Promise<PossibleField> {
    const { options } = fieldSchema

    // If the rollup field doesn't have a result type, treat as unsupported
    if (!options.result || typeof options.result !== "object" || !options.result.type) {
        return createUnsupportedField(fieldSchema)
    }

    // Create a temporary schema with the result type for recursive inference
    const resultSchema = {
        id: fieldSchema.id,
        name: fieldSchema.name,
        type: options.result.type as AirtableFieldSchema["type"],
        options: options.result.options as AirtableFieldSchema["options"],
    } as AirtableFieldSchema

    // Use the helper functions to infer the appropriate type based on the result
    const inferredField = await inferFieldByType(resultSchema, collection, tableIdBeingLinkedTo, 1)

    // Return the inferred field with the rollup field metadata
    return { ...inferredField, originalAirtableType: "rollup" } as PossibleField
}

async function inferRecordLinksField(
    fieldSchema: AirtableFieldSchema & { type: "multipleRecordLinks" },
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string
): Promise<PossibleField> {
    const foundCollections: { id: string; name: string }[] = []
    const type = fieldSchema.options.prefersSingleRecordLink ? "collectionReference" : "multiCollectionReference"

    if (fieldSchema.options.linkedTableId) {
        const tableId = await collection.getPluginData(PLUGIN_KEYS.TABLE_ID)

        if (tableIdBeingLinkedTo === fieldSchema.options.linkedTableId) {
            foundCollections.push({ id: collection.id, name: "This Collection" })
        } else if (tableId === fieldSchema.options.linkedTableId) {
            foundCollections.push({ id: collection.id, name: "This Collection" })
        }

        // Check if the linked table is another existing collection
        const existingCollections = await framer.getManagedCollections()
        for (const existingCollection of existingCollections.filter(
            existingCollection => existingCollection.id !== collection.id
        )) {
            const existingTableId = await existingCollection.getPluginData(PLUGIN_KEYS.TABLE_ID)
            if (existingTableId === fieldSchema.options.linkedTableId) {
                foundCollections.push({
                    id: existingCollection.id,
                    name: existingCollection.name,
                })
            }
        }
    }

    const foundCollection = foundCollections[0]

    // Only add unsupported field if we didn't find a matching collection
    if (!foundCollection) {
        return {
            id: fieldSchema.id,
            name: fieldSchema.name,
            userEditable: false,
            airtableType: fieldSchema.type,
            airtableOptions: fieldSchema.options,
            type,
            collectionId: "",
            supportedCollections: [],
            single: fieldSchema.options.prefersSingleRecordLink,
            originalAirtableType: fieldSchema.type,
        }
    }

    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: "multipleRecordLinks",
        airtableOptions: fieldSchema.options,
        supportedCollections: foundCollections,
        collectionId: foundCollection.id,
        type,
        single: fieldSchema.options.prefersSingleRecordLink,
        originalAirtableType: fieldSchema.type,
    }
}

/**
 * Infers the appropriate Framer field type based on an Airtable field type
 * @param fieldSchema The Airtable field schema
 * @param collection The current collection (needed for record links)
 * @param depth Used to prevent infinite recursion with nested formula fields
 */
async function inferFieldByType(
    fieldSchema: AirtableFieldSchema,
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string,
    depth = 0
): Promise<PossibleField> {
    // Prevent infinite recursion
    if (depth > 2) {
        return createUnsupportedField(fieldSchema)
    }

    switch (fieldSchema.type) {
        case "checkbox":
            return inferBooleanField(fieldSchema)

        case "singleSelect":
            return inferEnumField(fieldSchema)

        case "number":
        case "percent":
        case "currency":
        case "autoNumber":
        case "rating":
            return inferNumberField(fieldSchema)

        case "singleLineText":
            return inferStringField(fieldSchema)

        case "email":
        case "phoneNumber":
            return inferEmailOrPhoneField(fieldSchema)

        case "multilineText":
        case "richText":
            return inferTextField(fieldSchema)

        case "url":
            return inferUrlField(fieldSchema)

        case "multipleAttachments":
            return inferAttachmentsField(fieldSchema)

        case "date":
        case "dateTime":
        case "createdTime":
        case "lastModifiedTime":
            return inferDateField(fieldSchema)

        case "multipleRecordLinks":
            return await inferRecordLinksField(fieldSchema, collection, tableIdBeingLinkedTo)

        case "formula":
            return await inferFormulaField(fieldSchema, collection, tableIdBeingLinkedTo, depth)

        case "barcode":
            return inferBarcodeField(fieldSchema)

        case "aiText":
            return inferAiTextField(fieldSchema)

        case "duration":
            return inferDurationField(fieldSchema)

        case "multipleLookupValues":
            return await inferLookupField(fieldSchema, collection, tableIdBeingLinkedTo)

        case "rollup":
            return await inferRollupField(fieldSchema, collection, tableIdBeingLinkedTo)

        default:
            return createUnsupportedField(fieldSchema)
    }
}

async function inferFormulaField(
    fieldSchema: AirtableFieldSchema & { type: "formula" },
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string,
    depth = 0
): Promise<PossibleField> {
    const result = fieldSchema.options.result
    if (!result) {
        return createUnsupportedField(fieldSchema)
    }

    // Special case for attachments in formulas to ensure correct allowedFileTypes
    if (result.type === "multipleAttachments") {
        // For attachments, create a file type directly instead of using inferAttachmentsField
        // This is because we want a file type with specific allowed file types
        return {
            id: fieldSchema.id,
            name: fieldSchema.name,
            userEditable: false,
            airtableType: fieldSchema.type,
            airtableOptions: fieldSchema.options,
            type: "file",
            allowedFileTypes: ALLOWED_FILE_TYPES,
            allowedTypes: ["file", "image", "link"],
            originalAirtableType: fieldSchema.type,
        }
    }

    // Create a temporary schema with the result type for recursive inference
    const resultSchema = {
        id: fieldSchema.id,
        name: fieldSchema.name,
        type: result.type,
        options: {},
    } as AirtableFieldSchema

    // Handle formula result being another formula (prevent recursion)
    if (result.type === "formula") {
        return depth > 1
            ? createUnsupportedField(fieldSchema)
            : await inferFormulaField(
                  resultSchema as AirtableFieldSchema & { type: "formula" },
                  collection,
                  tableIdBeingLinkedTo,
                  depth + 1
              )
    }

    // For other types, use the helper functions directly
    return await inferFieldByType(resultSchema, collection, tableIdBeingLinkedTo, depth + 1)
}

function createUnsupportedField(fieldSchema: AirtableFieldSchema): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        airtableOptions: fieldSchema.options,
        type: "unsupported",
        allowedTypes: [fieldSchema.type],
        originalAirtableType: fieldSchema.type,
    }
}

export async function inferFields(collection: ManagedCollection, table: AirtableTable): Promise<PossibleField[]> {
    const fields: PossibleField[] = []

    for (const fieldSchema of table.fields) {
        const field = await inferFieldByType(fieldSchema, collection, table.id)
        fields.push(field)
    }

    return fields
}

export interface AirtableTable {
    id: string
    name: string
    fields: readonly AirtableFieldSchema[]
}
