import { ManagedCollection, ManagedCollectionField, framer } from "framer-plugin"
import { assert, generateHashId, isDefined, slugify } from "./utils"
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
const PLUGIN_FIELD_HASH_KEY = "airtablePluginFieldHash"
const FIELD_HASH_DELIMITER = "xK9mNq3r"

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
    let html = cellValue
        .replace(/^###### (.*)$/gim, "<h6>$1</h6>") // H6
        .replace(/^##### (.*)$/gim, "<h5>$1</h5>") // H5
        .replace(/^#### (.*)$/gim, "<h4>$1</h4>") // H4
        .replace(/^### (.*)$/gim, "<h3>$1</h3>") // H3
        .replace(/^## (.*)$/gim, "<h2>$1</h2>") // H2
        .replace(/^# (.*)$/gim, "<h1>$1</h1>") // H1
        .replace(/^> (.*)$/gim, "<blockquote>$1</blockquote>") // Blockquote
        .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>") // Bold
        .replace(/\*(.*?)\*/gim, "<em>$1</em>") // Italic
        .replace(/~~(.*?)~~/gim, "<del>$1</del>") // Strikethrough
        .replace(/`([^`]+)`/gim, "<code>$1</code>") // Inline code
        .replace(/```([\s\S]*?)```/gim, "<pre><code>$1</code></pre>") // Code block
        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>') // Links

    // Handle unordered and ordered lists separately
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, "<ul><li>$1</li></ul>")
    html = html.replace(/^\s*\d+\.\s+(.*)$/gim, "<ol><li>$1</li></ol>")

    // Combine consecutive <ul> or <ol> items
    html = html.replace(/<\/ul>\s*<ul>/gim, "").replace(/<\/ol>\s*<ol>/gim, "")

    // Ensure paragraphs are correctly wrapped
    html = html
        .split("\n\n") // Assume two newlines is a new paragraph
        .map(paragraph => {
            if (!/^<.*>.*<\/.*>$/.test(paragraph)) {
                return `<p>${paragraph}</p>`
            }
            return paragraph
        })
        .join("")

    return html
}

const ALLOWED_AIRTABLE_FORMULA_RESULT_TYPES = [
    "singleLineText",
    "email",
    "url",
    "phoneNumber",
    "checkbox",
    "number",
    "percent",
    "currency",
    "autoNumber",
    "rating",
    "duration",
    "multipleAttachments",
    "date",
    "dateTime",
    "createdTime",
    "lastModifiedTime",
    "richText",
    "multilineText",
]

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

        case "multipleRecordLinks": {
            if (fieldSchema.options.prefersSingleRecordLink) {
                return (cellValue as AirtableFieldValues["multipleRecordLinks"])[0]
            }

            return cellValue
        }

        case "formula": {
            if (
                fieldSchema.options.result &&
                ALLOWED_AIRTABLE_FORMULA_RESULT_TYPES.includes(fieldSchema.options.result.type)
            ) {
                return cellValue
            }

            return undefined
        }

        // Add more field types as needed
        default: {
            return undefined
        }
    }
}

export interface DataSource {
    collectionId: string
    name: string
}
export type TableIdMap = Map<string, DataSource[]>

/**
 * Get the collection field schema for an Airtable field.
 */
export function getCollectionForAirtableField(
    fieldSchema: AirtableFieldSchema,
    tableIdMap: TableIdMap
): ManagedCollectionField | null {
    const fieldMetadata = {
        id: fieldSchema.id,
        name: fieldSchema.name,
        userEditable: false,
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

        case "multipleRecordLinks": {
            const tableIds = tableIdMap.get(fieldSchema.options.linkedTableId)

            if (!tableIds || tableIds.length === 0) {
                // Table includes a relation to a table that hasn't been synced to Framer.
                // TODO: It would be better to surface this error to the user in
                // the UI instead of just skipping the field.
                return null
            }

            const tableId = tableIds[0].collectionId

            if (fieldSchema.options.prefersSingleRecordLink) {
                return { ...fieldMetadata, collectionId: tableId, type: "collectionReference" }
            }
            return { ...fieldMetadata, collectionId: tableId, type: "multiCollectionReference" }
        }

        case "formula": {
            const result = fieldSchema.options.result
            if (!result) return null

            switch (result.type) {
                case "singleLineText":
                case "email":
                case "url":
                case "phoneNumber":
                    return { ...fieldMetadata, type: "string" }
                case "checkbox":
                    return { ...fieldMetadata, type: "boolean" }
                case "number":
                case "percent":
                case "currency":
                case "autoNumber":
                case "rating":
                case "duration":
                    return { ...fieldMetadata, type: "number" }
                case "multipleAttachments":
                    return { ...fieldMetadata, type: "file", allowedFileTypes: ALLOWED_AIRTABLE_FILE_TYPES }
                case "date":
                case "dateTime":
                case "createdTime":
                case "lastModifiedTime":
                    return { ...fieldMetadata, type: "date" }
                case "richText":
                case "multilineText":
                    return { ...fieldMetadata, type: "formattedText" }
                default:
                    return null
            }
        }

        default:
            return null
    }
}

type FieldsById = Map<string, ManagedCollectionField>

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
    fields: ManagedCollectionField[]
    record: AirtableRecord
    tableSchema: AirtableTableSchema
    fieldsById: FieldsById
    slugFieldId: string
    status: SyncStatus
    unsyncedItemIds: Set<string>
    ignoredFieldIds: string[]
}

export interface SynchronizeResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

export interface SyncProgress {
    totalCount: number
    completedCount: number
    completedPercent: number
}

type OnProgressHandler = (progress: SyncProgress) => void

export interface SyncMutationOptions {
    baseId: string
    tableId: string
    fields: ManagedCollectionField[]
    ignoredFieldIds: string[]
    slugFieldId: string
    tableSchema: AirtableTableSchema
    lastSyncedTime: string | null
    onProgress: OnProgressHandler
}

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    isAuthenticated: boolean
    tableMapId: TableIdMap
}

export interface PluginContextUpdate {
    type: "update"
    baseId: string
    tableId: string
    tableSchema: AirtableTableSchema
    collection: ManagedCollection
    collectionFields: ManagedCollectionField[]
    lastSyncedTime: string
    hasChangedFields: boolean
    ignoredFieldIds: string[]
    slugFieldId: string | null
    isAuthenticated: boolean
    tableMapId: TableIdMap
}

export interface PluginContextNoTableAccess {
    type: "no-table-access"
    tableUrl: string
    tableName: string
}

export type PluginContext = PluginContextNew | PluginContextUpdate | PluginContextNoTableAccess

function processRecord({
    record,
    tableSchema,
    fieldsById,
    slugFieldId,
    status,
    unsyncedItemIds,
    ignoredFieldIds,
}: ProcessRecordParams) {
    let slugValue: string | null = null

    const fieldData: Record<string, unknown> = {}

    // Mark item as seen
    unsyncedItemIds.delete(record.id)

    for (const fieldSchema of tableSchema.fields) {
        if (ignoredFieldIds.includes(fieldSchema.id)) continue

        const field = fieldsById.get(fieldSchema.id)
        if (!field) continue

        // Airtable doesn't return checkbox fields in the record when they are set to false, so we need to set them to false by default
        if (fieldSchema.type === "checkbox") {
            fieldData[fieldSchema.id] = false
        }

        const cellValue = record.fields[fieldSchema.id]
        if (cellValue !== undefined) {
            const fieldValue = getFieldValue(fieldSchema, cellValue)

            if (fieldSchema.id === slugFieldId) {
                if (typeof fieldValue === "string") {
                    slugValue = slugify(fieldValue)
                }
            }

            if (!fieldValue) {
                status.warnings.push({
                    fieldId: fieldSchema.id,
                    message: `Value is missing for field ${field.name}`,
                })
            }

            fieldData[fieldSchema.id] = fieldValue
        }
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
    onProgress: OnProgressHandler,
    processRecordParams: Omit<ProcessRecordParams, "record" | "type" | "status">
) {
    const seenItemIds = new Set<string>()
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }

    const totalCount = records.length
    let completedCount = 0

    onProgress({ totalCount, completedCount, completedPercent: 0 })

    const collectionItems = records
        .map(record => {
            const result = processRecord({
                ...processRecordParams,
                record,
                status,
            })

            completedCount++
            onProgress({
                totalCount,
                completedCount,
                completedPercent: Math.round((completedCount / totalCount) * 100),
            })

            return result
        })
        .filter(isDefined)

    return {
        collectionItems,
        status,
        seenItemIds,
    }
}

function generateFieldHash(fields: AirtableFieldSchema[]): string {
    return generateHashId(
        [...fields]
            .map(f => `${f.id}:${f.type}`)
            .sort()
            .join(FIELD_HASH_DELIMITER)
    )
}

export async function syncTable({
    baseId,
    tableId,
    fields,
    ignoredFieldIds,
    slugFieldId,
    tableSchema,
    onProgress,
}: SyncMutationOptions): Promise<SynchronizeResult> {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map<string, ManagedCollectionField>()
    for (const field of fields) {
        fieldsById.set(field.id, field)
    }

    const unsyncedItemIds = new Set(await collection.getItemIds())
    const records = await fetchRecords({ baseId, tableId })
    const { collectionItems, status } = await processTable(records, onProgress, {
        tableSchema,
        fieldsById,
        slugFieldId,
        unsyncedItemIds,
        fields,
        ignoredFieldIds,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    const fieldHash = generateFieldHash(tableSchema.fields.filter(field => !ignoredFieldIds.includes(field.id)))

    await Promise.all([
        collection.setPluginData(PLUGIN_IGNORED_FIELD_IDS_KEY, JSON.stringify(ignoredFieldIds)),
        collection.setPluginData(PLUGIN_BASE_ID_KEY, baseId),
        collection.setPluginData(PLUGIN_TABLE_ID_KEY, tableId),
        collection.setPluginData(PLUGIN_TABLE_NAME_KEY, tableSchema.name),
        collection.setPluginData(PLUGIN_LAST_SYNCED_KEY, new Date().toISOString()),
        collection.setPluginData(PLUGIN_SLUG_ID_KEY, slugFieldId),
        collection.setPluginData(PLUGIN_FIELD_HASH_KEY, fieldHash),
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

function getIgnoredFieldIds(rawIgnoredFieldIds: string | null) {
    if (!rawIgnoredFieldIds) {
        return []
    }

    try {
        const parsed = JSON.parse(rawIgnoredFieldIds)
        if (!Array.isArray(parsed)) return []
        if (!parsed.every(val => typeof val === "string")) return []

        return parsed
    } catch {
        return []
    }
}

export async function getTableIdMapForBase(baseId: string | null): Promise<TableIdMap> {
    const tableMapId: TableIdMap = new Map()
    if (!baseId) return tableMapId

    const collections = await framer.getCollections()

    for (const collection of collections) {
        const collectionBaseId = await collection.getPluginData(PLUGIN_BASE_ID_KEY)
        if (collectionBaseId !== baseId) continue

        const collectionTableId = await collection.getPluginData(PLUGIN_TABLE_ID_KEY)
        if (!collectionTableId) continue

        const existingTableIds = tableMapId.get(collectionTableId) ?? []
        tableMapId.set(collectionTableId, [...existingTableIds, { collectionId: collection.id, name: collection.name }])
    }

    return tableMapId
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()
    const tokens = await auth.getTokens()
    const isAuthenticated = !!tokens

    const baseId = await collection.getPluginData(PLUGIN_BASE_ID_KEY)
    const tableId = await collection.getPluginData(PLUGIN_TABLE_ID_KEY)
    const tableName = await collection.getPluginData(PLUGIN_TABLE_NAME_KEY)

    const tableMapId = await getTableIdMapForBase(baseId)

    if (!baseId || !tableId || !tableName || !isAuthenticated) {
        return {
            type: "new",
            collection,
            isAuthenticated,
            tableMapId,
        }
    }

    try {
        const baseSchema = await fetchBaseSchema(baseId)
        const tableSchema = baseSchema.tables.find(tableSchema => tableSchema.id === tableId)

        assert(tableSchema, `Expected to find table schema for table with id: ${tableId}`)

        const [rawIgnoredFieldIds, lastSyncedTime, storedSlugFieldId, storedFieldHash] = await Promise.all([
            collection.getPluginData(PLUGIN_IGNORED_FIELD_IDS_KEY),
            collection.getPluginData(PLUGIN_LAST_SYNCED_KEY),
            collection.getPluginData(PLUGIN_SLUG_ID_KEY),
            collection.getPluginData(PLUGIN_FIELD_HASH_KEY),
        ])

        let slugColumn = storedSlugFieldId
        const ignoredFieldIds = getIgnoredFieldIds(rawIgnoredFieldIds)

        // We should not hash ignored fields since they are not synced to Framer,
        // and we don't want to trigger a re-sync of the table.
        const currentFieldHash = generateFieldHash(
            tableSchema.fields.filter(field => !ignoredFieldIds.includes(field.id))
        )

        assert(lastSyncedTime, "Expected last synced time to be set")

        // If the stored slug column is not in the table schema, we need to update it
        if (slugColumn && !tableSchema.fields.map(f => f.id).includes(slugColumn)) {
            slugColumn = null
        }

        return {
            type: "update",
            hasChangedFields: storedFieldHash !== currentFieldHash,
            isAuthenticated,
            baseId,
            tableId,
            tableSchema,
            collection,
            collectionFields,
            ignoredFieldIds,
            lastSyncedTime,
            slugFieldId: slugColumn,
            tableMapId,
        }
    } catch (e) {
        return {
            type: "no-table-access",
            tableName,
            tableUrl: `https://airtable.com/${baseId}/${tableId}`,
        }
    }
}
