import type { ManagedCollection, ManagedCollectionField } from "framer-plugin"

import { framer } from "framer-plugin"
import { type AirtableFieldSchema } from "./api"
import { PLUGIN_KEYS } from "./data"
import { ALLOWED_FILE_TYPES } from "./utils"

type AllowedType = ManagedCollectionField["type"] | "unsupported"

interface InferredField {
    /**
     * The type of the field as it appears in Airtable.
     *
     * Only set when fields are inferred.
     */
    readonly airtableType?: Exclude<AirtableFieldSchema["type"], "multipleRecordLinks" | "singleSelect">
    readonly allowedTypes?: [AllowedType, ...AllowedType[]]
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

interface InferredUnsupportedField {
    type: "unsupported"
    readonly allowedTypes: [AirtableFieldSchema["type"], ...AirtableFieldSchema["type"][]]
}

export type PossibleField = (
    | ManagedCollectionField
    | {
          id: string
          name: string
          userEditable: boolean
          type: "unsupported"
      }
) &
    (InferredField | InferredMultipleRecordLinksField | InferredEnumField | InferredUnsupportedField)

function inferBooleanField(fieldSchema: AirtableFieldSchema & { type: "checkbox" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "boolean",
        allowedTypes: ["boolean"],
    }
}

function inferEnumField(fieldSchema: AirtableFieldSchema & { type: "singleSelect" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
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
    }
}

function inferNumberField(
    fieldSchema: AirtableFieldSchema & {
        type: "number" | "percent" | "currency" | "autoNumber" | "rating" | "duration"
    }
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "number",
        allowedTypes: ["number"],
    }
}

function inferStringField(fieldSchema: AirtableFieldSchema & { type: "singleLineText" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "string",
        allowedTypes: ["string", "formattedText"],
    }
}

function inferEmailOrPhoneField(fieldSchema: AirtableFieldSchema & { type: "email" | "phoneNumber" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "string",
        allowedTypes: ["string", "link"],
    }
}

function inferTextField(fieldSchema: AirtableFieldSchema & { type: "multilineText" | "richText" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "formattedText",
        allowedTypes: ["formattedText", "string"],
    }
}

function inferUrlField(fieldSchema: AirtableFieldSchema & { type: "url" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "link",
        allowedTypes: ["link", "image", "file"],
    }
}

function inferAttachmentsField(fieldSchema: AirtableFieldSchema & { type: "multipleAttachments" }): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "image",
        allowedTypes: ["image", "file", "link"],
    }
}

function inferDateField(
    fieldSchema: AirtableFieldSchema & { type: "date" | "dateTime" | "createdTime" | "lastModifiedTime" }
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "date",
        allowedTypes: ["date"],
    }
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
                foundCollections.push({ id: existingCollection.id, name: existingCollection.name })
            }
        }
    }

    // Only add unsupported field if we didn't find a matching collection
    if (foundCollections.length === 0) {
        return {
            id: fieldSchema.id,
            name: fieldSchema.name,
            userEditable: false,
            airtableType: fieldSchema.type,
            type,
            collectionId: "",
            supportedCollections: [],
            single: fieldSchema.options.prefersSingleRecordLink,
        }
    }

    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: "multipleRecordLinks",
        supportedCollections: foundCollections,
        collectionId: foundCollections[0].id,
        type,
        single: fieldSchema.options.prefersSingleRecordLink,
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
        case "duration":
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

        // Future support for Lookup/Rollup can be added here
        // case "lookup":
        // case "rollup":

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
            type: "file",
            allowedFileTypes: ALLOWED_FILE_TYPES,
            allowedTypes: ["file", "image", "link"],
        }
    }

    // Create a temporary schema with the result type for recursive inference
    const resultSchema: AirtableFieldSchema = {
        id: fieldSchema.id,
        name: fieldSchema.name,
        type: result.type as any,
        options: {} as any,
    }

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
        type: "unsupported",
        allowedTypes: [fieldSchema.type],
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
