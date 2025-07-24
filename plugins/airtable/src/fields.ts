import type { ManagedCollection, ManagedCollectionFieldInput } from "framer-plugin"

import { framer } from "framer-plugin"
import type { AirtableFieldSchema } from "./api"
import { PLUGIN_KEYS } from "./data"
import { ALLOWED_FILE_TYPES } from "./utils"

type AllowedType = ManagedCollectionFieldInput["type"] | "unsupported"
type FieldSchema<T extends AirtableFieldSchema["type"]> = Extract<AirtableFieldSchema, { type: T }>

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
    readonly airtableType?: AirtableFieldSchema["type"]
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
        /**
         * The Airtable field schema options.
         * Only set when fields are inferred.
         */
        readonly airtableOptions?: AirtableFieldSchema["options"]
    }

/**
 * Creates the common metadata properties that are repeated across all inference functions
 */
function createFieldMetadata(fieldSchema: AirtableFieldSchema) {
    return {
        airtableOptions: fieldSchema.options,
        originalAirtableType: fieldSchema.type,
    }
}

function inferBooleanField(fieldSchema: FieldSchema<"checkbox">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "boolean",
        allowedTypes: ["boolean"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferEnumField(fieldSchema: FieldSchema<"singleSelect">): PossibleField {
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
        ...createFieldMetadata(fieldSchema),
    }
}

function inferNumberField(
    fieldSchema: FieldSchema<"number" | "percent" | "currency" | "autoNumber" | "rating" | "count">
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "number",
        allowedTypes: ["number"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferDurationField(fieldSchema: FieldSchema<"duration">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "string",
        allowedTypes: ["string", "number"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferStringField(fieldSchema: FieldSchema<"singleLineText">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "string",
        allowedTypes: ["string", "formattedText", "color"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferEmailOrPhoneField(fieldSchema: FieldSchema<"email" | "phoneNumber">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "string",
        allowedTypes: ["string", "link"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferTextField(fieldSchema: FieldSchema<"multilineText" | "richText">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "formattedText",
        allowedTypes: ["formattedText", "string"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferUrlField(fieldSchema: FieldSchema<"url">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "link",
        allowedTypes: ["link", "image", "file", "string"],
        ...createFieldMetadata(fieldSchema),
    }
}

// "link" type is not supported on attachments because file URLs expire after 2 hours.
// See https://airtable.com/developers/web/api/field-model#multipleattachment
function inferAttachmentsField(fieldSchema: FieldSchema<"multipleAttachments">): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "image",
        allowedTypes: ["image", "file", "array"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferDateField(
    fieldSchema: FieldSchema<"date" | "dateTime" | "createdTime" | "lastModifiedTime">
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "date",
        allowedTypes: ["date"],
        ...createFieldMetadata(fieldSchema),
    }
}

function inferStringBasedField(
    fieldSchema: FieldSchema<"barcode" | "aiText" | "singleCollaborator" | "createdBy" | "lastModifiedBy">
): PossibleField {
    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: fieldSchema.type,
        type: "string",
        allowedTypes: ["string"],
        ...createFieldMetadata(fieldSchema),
    }
}

async function inferLookupField(
    fieldSchema: FieldSchema<"multipleLookupValues">,
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string
): Promise<PossibleField> {
    const { options } = fieldSchema

    // If the lookup field doesn't have a result type, treat as unsupported
    if (!options.result) {
        return createUnsupportedField(fieldSchema)
    }

    const resultSchema: AirtableFieldSchema = {
        ...options.result,
        id: fieldSchema.id,
        name: fieldSchema.name,
    }

    const inferredField = await inferFieldByType(resultSchema, collection, tableIdBeingLinkedTo, 1)

    return { ...inferredField, originalAirtableType: "multipleLookupValues" }
}

async function inferRollupField(
    fieldSchema: FieldSchema<"rollup">,
    collection: ManagedCollection,
    tableIdBeingLinkedTo: string
): Promise<PossibleField> {
    const { options } = fieldSchema

    // If the rollup field doesn't have a result type, treat as unsupported
    if (!options.result) {
        return createUnsupportedField(fieldSchema)
    }

    const resultSchema: AirtableFieldSchema = {
        ...options.result,
        id: fieldSchema.id,
        name: fieldSchema.name,
    }

    const inferredField = await inferFieldByType(resultSchema, collection, tableIdBeingLinkedTo, 1)

    return { ...inferredField, originalAirtableType: "rollup" }
}

async function inferRecordLinksField(
    fieldSchema: FieldSchema<"multipleRecordLinks">,
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
            type,
            collectionId: "",
            supportedCollections: [],
            ...createFieldMetadata(fieldSchema),
        }
    }

    return {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
        airtableType: "multipleRecordLinks",
        supportedCollections: foundCollections,
        collectionId: foundCollection.id,
        type,
        ...createFieldMetadata(fieldSchema),
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
        case "count":
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
        case "aiText":
        case "singleCollaborator":
        case "createdBy":
        case "lastModifiedBy":
            return inferStringBasedField(fieldSchema)

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
    fieldSchema: FieldSchema<"formula">,
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
            type: "file",
            allowedFileTypes: ALLOWED_FILE_TYPES,
            allowedTypes: ["file", "image", "array"],
            ...createFieldMetadata(fieldSchema),
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
                  resultSchema as FieldSchema<"formula">,
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
        type: "unsupported",
        allowedTypes: [fieldSchema.type],
        ...createFieldMetadata(fieldSchema),
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
