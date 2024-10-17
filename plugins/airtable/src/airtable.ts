import { ManagedCollection, CollectionField, framer } from "framer-plugin"
import { assert, isDefined, slugify } from "./utils"
import auth from "./auth"
import {
    AirtableFieldSchema,
    AirtableFieldValue,
    AirtableFieldValues,
    AirtableRecord,
    AirtableTableSchema,
    fetchBaseSchema,
    fetchRecords,
} from "./api"
import { logSyncResult } from "./debug"

const PLUGIN_TABLE_ID_KEY = "airtablePluginTableId"
const PLUGIN_BASE_ID_KEY = "airtablePluginBaseId"
const PLUGIN_TABLE_NAME_KEY = "airtablePluginTableName"
const PLUGIN_IGNORED_FIELD_IDS_KEY = "airtablePluginIgnoredFieldIds"
const PLUGIN_LAST_SYNCED_KEY = "airtablePluginLastSynced"
const PLUGIN_SLUG_ID_KEY = "airtablePluginSlugId"

const ALLOWED_AIRTABLE_FILE_TYPES = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "tiff",
    "webp",
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "txt",
    "mp3",
    "aac",
    "mp4",
    "webm",
]

function richTextToHTML(cellValue: string): string {
    const lines = cellValue.split("\n")
    const htmlOutput: string[] = []
    let inList = false
    let listType: "ul" | "ol" | null = null
    let consecutiveEmptyLines = 0

    function closeList() {
        if (inList) {
            htmlOutput.push(listType === "ul" ? "</ul>" : "</ol>")
            inList = false
            listType = null
        }
    }

    function handleEmptyLine() {
        consecutiveEmptyLines++
        if (consecutiveEmptyLines > 1) {
            htmlOutput.push("<br>")
        }
    }

    function escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    lines.forEach((line, index) => {
        const trimmedLine = line.trim()

        if (trimmedLine === "") {
            handleEmptyLine()
            return
        }

        consecutiveEmptyLines = 0

        try {
            switch (true) {
                case trimmedLine.startsWith("#"): {
                    closeList()
                    const level = Math.min(trimmedLine.split(" ")[0].length, 6)
                    const headingText = escapeHtml(trimmedLine.substring(level + 1))
                    htmlOutput.push(`<h${level}>${headingText}</h${level}>`)
                    break
                }

                case trimmedLine.startsWith("`") && trimmedLine.endsWith("`"): {
                    closeList()
                    const code = escapeHtml(trimmedLine.slice(1, -1))
                    htmlOutput.push(`<code>${code}</code>`)
                    break
                }

                case trimmedLine.startsWith("[") && trimmedLine.includes("](") && trimmedLine.endsWith(")"): {
                    closeList()
                    const linkParts = trimmedLine.slice(1, -1).split("](")
                    if (linkParts.length === 2) {
                        const [linkText, url] = linkParts
                        htmlOutput.push(`<a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a>`)
                    } else {
                        htmlOutput.push(escapeHtml(trimmedLine))
                    }
                    break
                }

                case trimmedLine.startsWith(">"): {
                    closeList()
                    const quoteText = escapeHtml(trimmedLine.slice(1).trim())
                    htmlOutput.push(`<blockquote>${quoteText}</blockquote>`)
                    break
                }

                case trimmedLine.startsWith("[ ]") || trimmedLine.startsWith("[x]"): {
                    closeList()
                    const checked = trimmedLine.startsWith("[x]") ? "checked" : ""
                    const checkboxText = escapeHtml(trimmedLine.slice(3).trim())
                    htmlOutput.push(`<input type="checkbox" ${checked}> ${checkboxText}<br>`)
                    break
                }

                case trimmedLine.startsWith("-"): {
                    if (!inList || listType !== "ul") {
                        closeList()
                        htmlOutput.push("<ul>")
                        inList = true
                        listType = "ul"
                    }
                    const bulletText = escapeHtml(trimmedLine.slice(1).trim())
                    htmlOutput.push(`<li>${bulletText}</li>`)
                    break
                }

                case /^\d+\./.test(trimmedLine): {
                    if (!inList || listType !== "ol") {
                        closeList()
                        htmlOutput.push("<ol>")
                        inList = true
                        listType = "ol"
                    }
                    const numberedText = escapeHtml(trimmedLine.replace(/^\d+\./, "").trim())
                    htmlOutput.push(`<li>${numberedText}</li>`)
                    break
                }

                default: {
                    closeList()
                    const leadingSpacesMatch = line.match(/^\s*/)
                    const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0
                    const indentedText = "&nbsp;".repeat(leadingSpaces) + escapeHtml(line.trim())
                    htmlOutput.push(`<p>${indentedText}</p>`)
                }
            }
        } catch (error) {
            htmlOutput.push(escapeHtml(line))
        }
    })

    closeList()

    return htmlOutput.join("\n")
}

/**
 * Get the value of an Airtable field in a format compatible with a collection field.
 */
function getFieldValue(fieldSchema: AirtableFieldSchema, cellValue: AirtableFieldValue): unknown | undefined {
    switch (fieldSchema.type) {
        case "checkbox": {
            return cellValue === true
        }

        case "multipleAttachments": {
            return (cellValue as AirtableFieldValues["multipleAttachments"])[0].thumbnails?.full?.url
        }

        case "singleSelect": {
            if (typeof cellValue !== "string") return undefined

            const choice = fieldSchema.options.choices.find(choice => choice.name === cellValue)

            assert(choice, `Expected to find Airtable field choice id with name '${cellValue}' in field schema.`)

            return choice.id
        }

        case "date":
        case "dateTime":
        case "createdTime":
        case "lastModifiedTime": {
            return typeof cellValue === "string" ? new Date(cellValue).toUTCString() : undefined
        }

        case "number":
        case "percent":
        case "currency":
        case "autoNumber":
        case "rating":
        case "duration":
        case "singleLineText":
        case "email":
        case "url":
        case "phoneNumber":
        case "multilineText": {
            return cellValue
        }

        case "richText": {
            return richTextToHTML(cellValue as string)
        }

        // Add more field types as needed
        default: {
            return undefined
        }
    }
}

/**
 * Get the collection field schema for an Airtable field.
 */
export function getCollectionForAirtableField(fieldSchema: AirtableFieldSchema): CollectionField | null {
    const fieldMetadata = {
        id: fieldSchema.id,
        name: fieldSchema.name,
    }

    switch (fieldSchema.type) {
        case "checkbox":
            return { ...fieldMetadata, type: "boolean" }

        case "singleSelect":
            return {
                ...fieldMetadata,
                type: "enum",
                cases: fieldSchema.options.choices.map(choice => ({
                    id: choice.id,
                    name: choice.name,
                })),
            }

        case "number":
        case "percent":
        case "currency":
        case "autoNumber":
        case "rating":
        case "duration":
            return { ...fieldMetadata, type: "number" }

        case "singleLineText":
        case "email":
        case "url":
        case "phoneNumber":
            return { ...fieldMetadata, type: "string" }

        case "multilineText":
        case "richText":
            return { ...fieldMetadata, type: "formattedText" }

        case "multipleAttachments":
            // Make the file types all possible file types since validation is enforced on Airtable's side
            return { ...fieldMetadata, type: "file", allowedFileTypes: ALLOWED_AIRTABLE_FILE_TYPES }

        case "date":
        case "dateTime":
        case "createdTime":
        case "lastModifiedTime":
            return { ...fieldMetadata, type: "date" }

        default:
            return null
    }
}

type FieldsById = Map<string, CollectionField>

interface ItemResult {
    fieldId?: string
    message: string
}

interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}

interface ProcessRecordParams {
    fields: CollectionField[]
    record: AirtableRecord
    tableSchema: AirtableTableSchema
    fieldsById: FieldsById
    slugFieldId: string
    status: SyncStatus
    unsyncedItemIds: Set<string>
}

export interface SynchronizeResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

export interface SyncMutationOptions {
    baseId: string
    tableId: string
    fields: CollectionField[]
    ignoredFieldIds: string[]
    slugFieldId: string
    tableSchema: AirtableTableSchema
    lastSyncedTime: string | null
}

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    isAuthenticated: boolean
}

export interface PluginContextUpdate {
    type: "update"
    baseId: string
    tableId: string
    tableSchema: AirtableTableSchema
    collection: ManagedCollection
    collectionFields: CollectionField[]
    lastSyncedTime: string
    hasChangedFields: boolean
    ignoredFieldIds: string[]
    slugFieldId: string | null
    isAuthenticated: boolean
}

export interface PluginContextError {
    type: "error"
    message: string
    isAuthenticated: false
}

export type PluginContext = PluginContextNew | PluginContextUpdate | PluginContextError

function processRecord({ record, tableSchema, fieldsById, slugFieldId, status, unsyncedItemIds }: ProcessRecordParams) {
    let slugValue: string | null = null

    const fieldData: Record<string, unknown> = {}

    // Mark item as seen
    unsyncedItemIds.delete(record.id)

    for (const [fieldId, cellValue] of Object.entries(record.fields)) {
        const fieldSchema = tableSchema.fields.find(fieldSchema => fieldSchema.id === fieldId)

        if (!fieldSchema) continue

        const fieldValue = getFieldValue(fieldSchema, cellValue)

        if (fieldId === slugFieldId) {
            if (typeof fieldValue !== "string") {
                continue
            }

            slugValue = slugify(fieldValue)
        }

        const field = fieldsById.get(fieldId)

        // We can continue since the Airtable field was not included in the field mapping
        if (!field) continue

        if (!fieldValue) {
            status.warnings.push({
                fieldId,
                message: `Value is missing for field ${field.name}`,
            })
            continue
        }

        fieldData[fieldId] = fieldValue
    }

    if (!slugValue) {
        status.warnings.push({
            message: "Slug missing. Skipping item.",
        })

        return null
    }

    return {
        id: record.id,
        slug: slugValue,
        fieldData,
    }
}

async function processTable(
    records: AirtableRecord[],
    processRecordParams: Omit<ProcessRecordParams, "record" | "type" | "status">
) {
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }
    const collectionItems = records
        .map(record =>
            processRecord({
                ...processRecordParams,
                record,
                status,
            })
        )
        .filter(isDefined)

    return {
        collectionItems,
        status,
    }
}

export async function syncTable({
    baseId,
    tableId,
    fields,
    ignoredFieldIds,
    slugFieldId,
    tableSchema,
}: SyncMutationOptions): Promise<SynchronizeResult> {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map<string, CollectionField>()
    for (const field of fields) {
        fieldsById.set(field.id, field)
    }

    const unsyncedItemIds = new Set(await collection.getItemIds())
    const records = await fetchRecords({ baseId, tableId })
    const { collectionItems, status } = await processTable(records, {
        tableSchema,
        fieldsById,
        slugFieldId,
        unsyncedItemIds,
        fields,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await Promise.all([
        collection.setPluginData(PLUGIN_IGNORED_FIELD_IDS_KEY, JSON.stringify(ignoredFieldIds)),
        collection.setPluginData(PLUGIN_BASE_ID_KEY, baseId),
        collection.setPluginData(PLUGIN_TABLE_ID_KEY, tableId),
        collection.setPluginData(PLUGIN_TABLE_NAME_KEY, tableSchema.name),
        collection.setPluginData(PLUGIN_LAST_SYNCED_KEY, new Date().toISOString()),
        collection.setPluginData(PLUGIN_SLUG_ID_KEY, slugFieldId),
    ])

    const result: SynchronizeResult = {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }

    logSyncResult(result, collectionItems)

    return result
}

/*
 * Given a set of Airtable field schemas, returns a list of possible
 * fields that can be used as slugs.
 */
export function getPossibleSlugFields(fieldsSchema: AirtableFieldSchema[]) {
    const options: AirtableFieldSchema[] = []

    for (const fieldSchema of fieldsSchema) {
        switch (fieldSchema.type) {
            case "singleLineText":
                options.push(fieldSchema)
        }
    }

    return options
}

function getSuggestedFieldsForTable(tableSchema: AirtableTableSchema, ignoredFieldIds: string[]) {
    const fields: CollectionField[] = []

    for (const fieldSchema of tableSchema.fields) {
        if (ignoredFieldIds.includes(fieldSchema.id)) continue

        const field = getCollectionForAirtableField(fieldSchema)
        if (field) {
            fields.push(field)
        }
    }

    return fields
}

export function hasFieldConfigurationChanged(
    currentCollectionFields: CollectionField[],
    tableSchema: AirtableTableSchema,
    ignoredFieldIds: string[]
) {
    const currentFieldsById = new Map<string, CollectionField>()
    for (const field of currentCollectionFields) {
        currentFieldsById.set(field.id, field)
    }

    const suggestedFields = getSuggestedFieldsForTable(tableSchema, ignoredFieldIds)
    if (suggestedFields.length !== currentCollectionFields.length) return true

    for (const field of suggestedFields) {
        const currentField = currentFieldsById.get(field.id)

        if (!currentField) return true
        if (currentField.type !== field.type) return true
    }

    return false
}

function getIgnoredFieldIds(rawIgnoredFieldIds: string | null) {
    if (!rawIgnoredFieldIds) {
        return []
    }

    const parsed = JSON.parse(rawIgnoredFieldIds)
    if (!Array.isArray(parsed)) return []
    if (!parsed.every(val => typeof val === "string")) return []

    return parsed
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()
    const tokens = await auth.getTokens()
    const isAuthenticated = !!tokens

    const baseId = await collection.getPluginData(PLUGIN_BASE_ID_KEY)
    const tableId = await collection.getPluginData(PLUGIN_TABLE_ID_KEY)

    if (!baseId || !tableId || !isAuthenticated) {
        return {
            type: "new",
            collection,
            isAuthenticated,
        }
    }

    const baseSchema = await fetchBaseSchema(baseId)
    const tableSchema = baseSchema.tables.find(tableSchema => tableSchema.id === tableId)

    assert(tableSchema, `Expected to find table schema for table with id: ${tableId}`)

    const [rawIgnoredFieldIds, lastSyncedTime, slugFieldId] = await Promise.all([
        collection.getPluginData(PLUGIN_IGNORED_FIELD_IDS_KEY),
        collection.getPluginData(PLUGIN_LAST_SYNCED_KEY),
        collection.getPluginData(PLUGIN_SLUG_ID_KEY),
    ])
    const ignoredFieldIds = getIgnoredFieldIds(rawIgnoredFieldIds)

    assert(lastSyncedTime, "Expected last synced time to be set")

    return {
        type: "update",
        hasChangedFields: hasFieldConfigurationChanged(collectionFields, tableSchema, ignoredFieldIds),
        isAuthenticated,
        baseId,
        tableId,
        tableSchema,
        collection,
        collectionFields,
        ignoredFieldIds,
        lastSyncedTime,
        slugFieldId,
    }
}
