import { type Column, ColumnTypeEnum } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/Column"
import type { HubDbTableRowV3 } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/HubDbTableRowV3"
import type { Option } from "@hubspot/api-client/lib/codegen/cms/hubdb/models/Option"
import { useMutation } from "@tanstack/react-query"
import {
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
} from "framer-plugin"
import { fetchPublishedTable, fetchTableRows, type HubDBFile, type HubDBImage, type HubDBValueOption } from "./api"
import {
    computeFieldSets,
    createFieldSetHash,
    type FieldsById,
    logSyncResult,
    MAX_CMS_ITEMS,
    type SyncResult,
    type SyncStatus,
    slugify,
} from "./cms"
import { assert, isDefined } from "./utils"

const PLUGIN_TABLE_ID_KEY = "hubdbTableId"
const PLUGIN_INCLUDED_FIELDS_HASH_KEY = "hubdbIncludedFieldHash"
const PLUGIN_SLUG_FIELD_ID_KEY = "hubdbSlugFieldId"

export interface SyncMutationOptions {
    fields: ManagedCollectionFieldInput[]
    tableId: string
    slugFieldId: string
    includedFieldIds: string[]
}

export interface ProcessRowParams {
    fields: ManagedCollectionFieldInput[]
    row: HubDbTableRowV3
    fieldsById: FieldsById
    columns: Column[]
    slugFieldId: string
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
    includedFieldIds: string[]
    hasChangedFields: boolean
    slugFieldId: string
    columns: Column[]
    collectionFields: ManagedCollectionFieldInput[]
}

export type HubDBPluginContext = HubDBPluginContextNew | HubDBPluginContextUpdate

/**
 * Get the value of a HubDB cell in a format compatible with a collection field.
 */
function getFieldValue(column: Column, cellValue: unknown): FieldDataEntryInput | undefined {
    switch (column.type) {
        case ColumnTypeEnum.Text: {
            if (typeof cellValue !== "string") return undefined
            return { type: "string", value: cellValue }
        }

        case ColumnTypeEnum.Url: {
            if (typeof cellValue !== "string") return undefined
            return { type: "link", value: cellValue }
        }

        case ColumnTypeEnum.Richtext: {
            if (typeof cellValue !== "string") return undefined
            return { type: "formattedText", value: cellValue }
        }

        case ColumnTypeEnum.Currency:
        case ColumnTypeEnum.Number: {
            if (typeof cellValue !== "number") return undefined
            return { type: "number", value: cellValue }
        }

        case ColumnTypeEnum.Date:
        case ColumnTypeEnum.Datetime: {
            if (typeof cellValue !== "number") return undefined
            return { type: "date", value: new Date(cellValue).toUTCString() }
        }

        case ColumnTypeEnum.Boolean: {
            return { type: "boolean", value: cellValue === 1 }
        }

        case ColumnTypeEnum.Select: {
            return { type: "enum", value: (cellValue as HubDBValueOption).name }
        }

        case ColumnTypeEnum.Image: {
            return { type: "image", value: (cellValue as HubDBImage).url }
        }

        case ColumnTypeEnum.File: {
            return { type: "file", value: (cellValue as HubDBFile).url }
        }

        default: {
            return undefined
        }
    }
}

/**
 * Get the collection field schema for a HubDB column.
 */
export function getCollectionFieldForHubDBColumn(column: Column): ManagedCollectionFieldInput | null {
    assert(column.id)

    const fieldMetadata = {
        id: column.id,
        name: column.label,
        userEditable: false,
    }

    switch (column.type) {
        case ColumnTypeEnum.Text:
            return { ...fieldMetadata, type: "string" }

        case ColumnTypeEnum.Currency:
        case ColumnTypeEnum.Number:
            return { ...fieldMetadata, type: "number" }

        case ColumnTypeEnum.Date:
        case ColumnTypeEnum.Datetime:
            return { ...fieldMetadata, type: "date" }

        case ColumnTypeEnum.Url:
            return { ...fieldMetadata, type: "link" }

        case ColumnTypeEnum.Richtext:
            return { ...fieldMetadata, type: "formattedText" }

        case ColumnTypeEnum.Boolean:
            return { ...fieldMetadata, type: "boolean" }

        case ColumnTypeEnum.Image:
            return { ...fieldMetadata, type: "image" }

        case ColumnTypeEnum.File:
            return { ...fieldMetadata, type: "file", allowedFileTypes: [] }

        case ColumnTypeEnum.Select: {
            const cases = column.options
                ?.filter((opt): opt is Option & { label: string } => opt.label !== undefined && opt.name !== "")
                .map(opt => ({ name: opt.label, id: opt.name }))

            if (!cases) return null

            return {
                ...fieldMetadata,
                type: "enum",
                cases,
            }
        }

        // TODO: Implement collection references
        case ColumnTypeEnum.ForeignId:
        default:
            return null
    }
}

/**
 * Given a set of HubDB columns, return a list of possible
 * fields that can be used as slugs.
 */
export function getPossibleSlugFields(columns: Column[]) {
    const options: Column[] = []

    for (const col of columns) {
        switch (col.type) {
            case ColumnTypeEnum.Text:
                options.push(col)
                break
        }
    }

    return options
}

export function shouldSyncHubDBImmediately(
    pluginContext: HubDBPluginContext
): pluginContext is HubDBPluginContextUpdate {
    if (pluginContext.type !== "update") return false
    if (pluginContext.hasChangedFields) return false

    return true
}

/**
 * Determines whether the field configuration of the currently managed collection
 * fields differ from the HubDb columns
 */
function hasFieldConfigurationChanged(
    currentManagedCollectionFields: ManagedCollectionFieldInput[],
    columns: Column[],
    includedFieldIds: string[]
): boolean {
    const currentFieldsById = new Map(currentManagedCollectionFields.map(field => [field.id, field]))

    // Consider current included fields only
    const includedColumns = columns.filter(col => isDefined(col.id) && includedFieldIds.includes(col.id))

    if (includedColumns.length !== currentManagedCollectionFields.length) {
        return true
    }

    for (const column of includedColumns) {
        assert(column.id)
        const collectionField = currentFieldsById.get(column.id)
        const expectedField = getCollectionFieldForHubDBColumn(column)

        if (!collectionField) {
            return true
        }

        if (!expectedField || collectionField.type !== expectedField.type) {
            return true
        }
    }

    return false
}

function processRow({ row, columns, fieldsById, slugFieldId, status, unsyncedItemIds }: ProcessRowParams) {
    let slugValue: string | null = null
    const fieldData: FieldDataInput = {}

    assert(row.id)
    unsyncedItemIds.delete(row.id)

    for (const [columnName, cellValue] of Object.entries(row.values)) {
        const column = columns.find(col => col.name === columnName)

        if (!column) continue

        assert(column.id)

        const collectionFieldValue = getFieldValue(column, cellValue)

        if (column.id === slugFieldId) {
            if (typeof cellValue !== "string") continue

            slugValue = slugify(cellValue)
        }

        const field = fieldsById.get(column.id)

        // Not included in field mapping, skip
        if (!field) continue

        if (collectionFieldValue === undefined) {
            status.warnings.push({
                fieldName: columnName,
                message: `Value is missing for field ${field.name}`,
            })
        } else {
            fieldData[column.id] = collectionFieldValue
        }
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

function processAllRows(rows: HubDbTableRowV3[], processRowParams: Omit<ProcessRowParams, "row" | "status">) {
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

export async function syncHubDBTable({ fields, tableId, slugFieldId, includedFieldIds }: SyncMutationOptions) {
    const collection = await framer.getActiveManagedCollection()

    const fieldsById = new Map(fields.map(field => [field.id, field]))
    const unsyncedItemIds = new Set(await collection.getItemIds())
    const table = await fetchPublishedTable(tableId)

    assert(table.columns)

    const includedFieldNames = table.columns
        .filter(col => isDefined(col.id) && Array.from(new Set([...includedFieldIds, slugFieldId])).includes(col.id))
        .map(col => col.name)
    const { results: rows } = await fetchTableRows(tableId, includedFieldNames, MAX_CMS_ITEMS)

    assert(table.columns)

    const { collectionItems, status } = processAllRows(rows, {
        unsyncedItemIds,
        columns: table.columns,
        slugFieldId,
        fields,
        fieldsById,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await Promise.all([
        collection.setPluginData(PLUGIN_INCLUDED_FIELDS_HASH_KEY, createFieldSetHash(includedFieldIds)),
        collection.setPluginData(PLUGIN_TABLE_ID_KEY, tableId),
        collection.setPluginData(PLUGIN_SLUG_FIELD_ID_KEY, slugFieldId),
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

export async function getHubDBPluginContext(): Promise<HubDBPluginContext> {
    const collection = await framer.getActiveManagedCollection()
    const collectionFields = await collection.getFields()

    const [tableId, rawIncludedFieldHash, slugFieldId] = await Promise.all([
        collection.getPluginData(PLUGIN_TABLE_ID_KEY),
        collection.getPluginData(PLUGIN_INCLUDED_FIELDS_HASH_KEY),
        collection.getPluginData(PLUGIN_SLUG_FIELD_ID_KEY),
    ])

    if (!tableId || !slugFieldId || !rawIncludedFieldHash) {
        return { type: "new", collection }
    }

    const { columns } = await fetchPublishedTable(tableId)
    assert(columns)

    const { includedFieldIds, hasHashChanged } = computeFieldSets({
        currentFields: collectionFields,
        allPossibleFieldIds: columns.map(col => col.id).filter(isDefined),
        storedHash: rawIncludedFieldHash,
    })

    let hasChangedFields: boolean
    // Skip doing full check since we already know it differs
    if (hasHashChanged) {
        hasChangedFields = true
    } else {
        // Do full check
        hasChangedFields = hasFieldConfigurationChanged(collectionFields, columns, includedFieldIds)
    }

    return {
        type: "update",
        hasChangedFields,
        tableId,
        columns,
        includedFieldIds,
        slugFieldId,
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
        mutationFn: async (args: SyncMutationOptions) => {
            const collection = await framer.getActiveManagedCollection()
            await collection.setFields(args.fields)
            return await syncHubDBTable(args)
        },
        onSuccess,
        onError,
    })
}
