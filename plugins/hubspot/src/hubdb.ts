import { framer, ManagedCollection, ManagedCollectionField } from "framer-plugin"
import {
    fetchPublishedTable,
    fetchTableRows,
    HubDBCellValue,
    HubDBColumn,
    HubDBFile,
    HubDBImage,
    HubDBTableRow,
    HubDBValueOption,
    HubDBVideo,
} from "./api"
import { FieldsById, MAX_CMS_ITEMS, richTextToHTML, slugify, logSyncResult, SyncResult, SyncStatus } from "./cms"
import { isDefined, parseJsonToArray } from "./utils"
import { useMutation } from "@tanstack/react-query"
import { HUBSPOT_FILE_TYPES } from "./constants"

const PLUGIN_TABLE_ID_KEY = "hubdbTableId"
const PLUGIN_INCLUDED_FIELD_NAMES_KEY = "hubdbIncludedFieldNames"
const PLUGIN_SLUG_FIELD_NAME_KEY = "hubdbSlugFieldName"

export interface SyncMutationOptions {
    fields: ManagedCollectionField[]
    tableId: string
    slugFieldName: string
    includedFieldNames: string[]
}

export interface ProcessRowParams {
    fields: ManagedCollectionField[]
    row: HubDBTableRow
    fieldsById: FieldsById
    columns: HubDBColumn[]
    slugFieldName: string
    status: SyncStatus
    unsyncedItemIds: Set<string>
}

export interface HubDBPluginContextNew {
    type: "new"
    collection: ManagedCollection
}

export interface HubDBPluginContextUpdate {
    type: "update"
    collection: ManagedCollection
    tableId: string
    includedFieldNames: string[]
    hasChangedFields: boolean
    slugFieldName: string
    columns: HubDBColumn[]
    collectionFields: ManagedCollectionField[]
}

export type HubDBPluginContext = HubDBPluginContextNew | HubDBPluginContextUpdate

/**
 * Get the value of a HubDB cell in a format compatible with a collection field.
 */
function getFieldValue(column: HubDBColumn, cellValue: HubDBCellValue): unknown | undefined {
    switch (column.type) {
        case "TEXT":
        case "EMAIL":
        case "PHONE":
        case "URL":
            return typeof cellValue === "string" ? cellValue : undefined

        case "RICHTEXT":
            return typeof cellValue === "string" ? richTextToHTML(cellValue) : undefined

        case "NUMBER":
            return typeof cellValue === "number" ? cellValue : undefined

        case "DATE":
            return typeof cellValue === "number" ? new Date(cellValue).toISOString() : undefined

        case "BOOLEAN":
            return cellValue === 1 ? true : false

        case "SELECT":
            return (cellValue as HubDBValueOption).name

        case "IMAGE":
            return (cellValue as HubDBImage).url

        case "VIDEO":
            return (cellValue as HubDBVideo).url

        case "FILE":
            return (cellValue as HubDBFile).url

        case "CURRENCY":
            return typeof cellValue === "number" ? cellValue : undefined

        case "MULTISELECT":
        case "LOCATION":
        case "USER":
        default:
            return undefined
    }
}

/**
 * Get the collection field schema for a HubDB column
 */
export function getCollectionFieldForHubDBColumn(column: HubDBColumn): ManagedCollectionField | null {
    const fieldMetadata = {
        id: column.name,
        name: column.label,
        userEditable: false,
    }

    switch (column.type) {
        case "TEXT":
        case "EMAIL":
        case "PHONE":
            return { ...fieldMetadata, type: "string" }

        case "CURRENCY":
        case "NUMBER":
            return { ...fieldMetadata, type: "number" }

        case "DATE":
            return { ...fieldMetadata, type: "date" }

        case "URL":
            return { ...fieldMetadata, type: "link" }
            break

        case "RICHTEXT":
            return { ...fieldMetadata, type: "formattedText" }

        case "BOOLEAN":
            return { ...fieldMetadata, type: "boolean" }

        case "IMAGE":
            return { ...fieldMetadata, type: "image" }

        case "VIDEO":
            return { ...fieldMetadata, type: "file", allowedFileTypes: HUBSPOT_FILE_TYPES }

        case "FILE":
            return { ...fieldMetadata, type: "file", allowedFileTypes: HUBSPOT_FILE_TYPES }

        case "SELECT": {
            const cases = column.options?.map(opt => ({ name: opt.label, id: opt.name }))
            if (!cases) return null

            return {
                ...fieldMetadata,
                type: "enum",
                cases,
            }
        }

        default:
            return null
    }
}

function processRow({ row, columns, fieldsById, slugFieldName, status, unsyncedItemIds }: ProcessRowParams) {
    let slugValue: string | null = null
    const fieldData: Record<string, unknown> = {}

    unsyncedItemIds.delete(row.id)

    for (const [columnName, cellValue] of Object.entries(row.values)) {
        const column = columns.find(col => col.name === columnName)

        if (!column) continue

        const collectionFieldValue = getFieldValue(column, cellValue)

        if (columnName === slugFieldName) {
            if (typeof cellValue !== "string") continue

            slugValue = slugify(cellValue)
        }

        const field = fieldsById.get(columnName)

        // Not included in field mapping, skip
        if (!field) continue

        if (collectionFieldValue === undefined) {
            status.warnings.push({
                fieldName: columnName,
                message: `Value is missing for field ${field.name}`,
            })
        }

        fieldData[columnName] = collectionFieldValue
    }

    if (!slugValue) {
        status.warnings.push({
            message: "Slug missing. Skipping item.",
        })

        return null
    }

    return {
        id: row.id,
        slug: slugValue,
        fieldData,
    }
}

function processAllRows(rows: HubDBTableRow[], processRowParams: Omit<ProcessRowParams, "row" | "status">) {
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }

    const collectionItems = rows.map(row => processRow({ ...processRowParams, status, row })).filter(isDefined)

    return {
        collectionItems,
        status,
    }
}

export async function syncHubDBTable({ fields, tableId, slugFieldName, includedFieldNames }: SyncMutationOptions) {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map(fields.map(field => [field.id, field]))
    const unsyncedItemIds = new Set(await collection.getItemIds())
    const table = await fetchPublishedTable(tableId)
    // Always include the slug field
    const { results: rows } = await fetchTableRows(
        tableId,
        Array.from(new Set([...includedFieldNames, slugFieldName])),
        MAX_CMS_ITEMS
    )

    const { collectionItems, status } = processAllRows(rows, {
        unsyncedItemIds,
        columns: table.columns,
        slugFieldName,
        fields,
        fieldsById,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await Promise.all([
        collection.setPluginData(PLUGIN_INCLUDED_FIELD_NAMES_KEY, JSON.stringify(includedFieldNames)),
        collection.setPluginData(PLUGIN_TABLE_ID_KEY, tableId),
        collection.setPluginData(PLUGIN_SLUG_FIELD_NAME_KEY, slugFieldName),
    ])

    const result: SyncResult = {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }

    logSyncResult(result, collectionItems)

    return result
}

/**
 * Given a set of HubDB columns, return a list of possible
 * fields that can be used as slugs.
 */
export function getPossibleSlugFields(columns: HubDBColumn[]) {
    const options: HubDBColumn[] = []

    for (const col of columns) {
        switch (col.type) {
            case "TEXT":
                options.push(col)
                break
        }
    }

    return options
}

function getSuggestedFieldsForTable(columns: HubDBColumn[], includedFieldNames: string[]) {
    const fields: ManagedCollectionField[] = []

    for (const col of columns) {
        if (!includedFieldNames.includes(col.name)) continue

        const field = getCollectionFieldForHubDBColumn(col)
        if (field) {
            fields.push(field)
        }
    }

    return fields
}

export function hasFieldConfigurationChanged(
    currentManagedCollectionFields: ManagedCollectionField[],
    columns: HubDBColumn[],
    includedFieldNames: string[]
) {
    const currentFieldsById = new Map<string, ManagedCollectionField>()
    for (const field of currentManagedCollectionFields) {
        currentFieldsById.set(field.id, field)
    }

    const suggestedFields = getSuggestedFieldsForTable(columns, includedFieldNames)
    if (suggestedFields.length !== currentManagedCollectionFields.length) return true

    for (const field of suggestedFields) {
        const currentField = currentFieldsById.get(field.id)

        if (!currentField) return true
        if (currentField.type !== field.type) return true
    }

    return false
}

export function shouldSyncHubDBImmediately(
    pluginContext: HubDBPluginContext
): pluginContext is HubDBPluginContextUpdate {
    if (pluginContext.type !== "update") return false
    if (pluginContext.hasChangedFields) return false

    return true
}

export async function getHubDBPluginContext(): Promise<HubDBPluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()

    const [tableId, rawIncludedFieldNames, slugFieldName] = await Promise.all([
        collection.getPluginData(PLUGIN_TABLE_ID_KEY),
        collection.getPluginData(PLUGIN_INCLUDED_FIELD_NAMES_KEY),
        collection.getPluginData(PLUGIN_SLUG_FIELD_NAME_KEY),
    ])
    const includedFieldNames = parseJsonToArray<string>(rawIncludedFieldNames)

    if (!tableId || !includedFieldNames || !slugFieldName) {
        return { type: "new", collection }
    }

    const { columns } = await fetchPublishedTable(tableId)

    return {
        type: "update",
        hasChangedFields: hasFieldConfigurationChanged(collectionFields, columns, includedFieldNames),
        tableId,
        columns,
        includedFieldNames,
        slugFieldName,
        collectionFields,
        collection,
    }
}

export const useSyncHubDBTableMutation = ({
    onSuccess,
    onError,
}: {
    onSuccess?: (result: SyncResult) => void
    onError?: (e: Error) => void
}) => {
    return useMutation({
        mutationFn: (args: SyncMutationOptions) => syncHubDBTable(args),
        onSuccess,
        onError,
    })
}
