import { useMutation, useQuery } from "@tanstack/react-query"
import { CollectionField, ManagedCollection, ManagedCollectionField, framer } from "framer-plugin"
import auth from "./auth"
import { assert, columnToLetter, generateHashId, isDefined, parseStringToArray, slugify } from "./utils"
import { logSyncResult } from "./debug.ts"
import { queryClient } from "./main.tsx"

const SHEETS_API_URL = "https://sheets.googleapis.com/v4"
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3"

const PLUGIN_SPREADSHEET_ID_KEY = "sheetsPluginSpreadsheetId"
const PLUGIN_SHEET_TITLE_KEY = "sheetsPluginSheetTitle"
const PLUGIN_SHEET_HEADER_ROW = "sheetsPluginSheetHeaderRow"
const PLUGIN_IGNORED_FIELD_COLUMN_INDEXES_KEY = "sheetsPluginIgnoredFieldColumnIndexes"
const PLUGIN_SLUG_INDEX_COLUMN_KEY = "sheetsPluginSlugIndexColumn"
const PLUGIN_LAST_SYNCED_KEY = "sheetsPluginLastSynced"

const CELL_BOOLEAN_VALUES = ["Y", "yes", "true", "TRUE", "Yes", 1, true]

interface SpreadsheetInfoProperties {
    title: string
}

interface SheetProperties {
    title: string
}

interface SpreadsheetInfoSheet {
    properties: SheetProperties
}

interface SpreadsheetInfo {
    spreadsheetId: string
    spreadsheetUrl: string
    properties: SpreadsheetInfoProperties
    sheets: SpreadsheetInfoSheet[]
}

export type CellValue = string | number | boolean

export type Row = CellValue[]

export type HeaderRow = string[]

export interface Sheet {
    range: string // e.g. 'Sheet1!A1:AF15'
    majorDimention: "ROWS" | "COLUMNS"
    values: [HeaderRow, ...Row[]]
}

type QueryParams = Record<string, string | number | boolean>

interface RequestOptions {
    path: string
    method?: "get" | "post" | "delete" | "patch"
    service?: "drive" | "sheets"
    query?: QueryParams
    body?: Record<string, unknown>
}

const request = async <T = unknown>({ path, service = "sheets", method = "get", query, body }: RequestOptions) => {
    const tokens = await auth.getTokens()

    if (!tokens) {
        throw new Error("Invalid authentication.")
    }

    let serviceUrl
    switch (service) {
        case "drive":
            serviceUrl = DRIVE_API_URL
            break
        case "sheets":
            serviceUrl = SHEETS_API_URL
            break
        default:
            throw new Error("Invalid service.")
    }

    let url = `${serviceUrl}${path}`

    if (query) {
        const queryParams = Object.entries(query)
            .map(([key, value]) => {
                if (value !== undefined) {
                    return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
                }

                return ""
            })
            .filter(Boolean)
            .join("&")

        if (queryParams) {
            url += `?${queryParams}`
        }
    }

    // Ensure single quotes are encoded correctly
    url = url.replace(/'/g, "%27")

    const res = await fetch(url, {
        method: method.toUpperCase(),
        body: body ? JSON.stringify(body) : undefined,
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
        },
    })

    const json = await res.json()

    if (!res.ok) {
        const errorMessage = json.error.message
        throw new Error("Failed to fetch Google Sheets API: " + errorMessage)
    }

    return json as T
}

function fetchSpreadsheetInfo(spreadsheetId: string) {
    return request<SpreadsheetInfo>({
        path: `/spreadsheets/${spreadsheetId}`,
        query: {
            includeGridData: "true",
            fields: "spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title",
        },
    })
}

function fetchSheet(spreadsheetId: string, sheetTitle: string, range?: string) {
    return request<Sheet>({
        path: `/spreadsheets/${spreadsheetId}/values/${sheetTitle}`,
        query: {
            range: range ?? sheetTitle,
            valueRenderOption: "UNFORMATTED_VALUE",
            dateTimeRenderOption: "FORMATTED_STRING",
        },
    })
}

export const useSpreadsheetInfoQuery = (spreadsheetId: string) => {
    return useQuery<SpreadsheetInfo>({
        queryKey: ["spreadsheet", spreadsheetId],
        queryFn: () => fetchSpreadsheetInfo(spreadsheetId),
        enabled: !!spreadsheetId,
    })
}

export const useSheetQuery = (spreadsheetId: string, sheetTitle: string, range?: string) => {
    return useQuery<Sheet>({
        queryKey: ["sheet", spreadsheetId, sheetTitle, range],
        queryFn: () => fetchSheet(spreadsheetId, sheetTitle, range),
        enabled: !!spreadsheetId && !!sheetTitle,
    })
}

function fetchSheetWithClient(spreadsheetId: string, sheetTitle: string, range?: string) {
    return queryClient.fetchQuery({
        queryKey: ["sheet", spreadsheetId, sheetTitle, range],
        queryFn: () => fetchSheet(spreadsheetId, sheetTitle, range),
    })
}

export type CollectionFieldType = CollectionField["type"]

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    isAuthenticated: boolean
}

export interface PluginContextUpdate {
    type: "update"
    spreadsheetId: string
    sheetTitle: string
    collectionFields: CollectionField[]
    collection: ManagedCollection
    hasChangedFields: boolean
    ignoredFieldColumnIndexes: number[]
    slugFieldColumnIndex: number | null
    isAuthenticated: boolean
    sheet: Sheet
    lastSyncedTime: string
    sheetHeaderRow: string[]
}

export interface PluginContextError {
    type: "error"
    message: string
    isAuthenticated: false
}

export type PluginContext = PluginContextNew | PluginContextUpdate | PluginContextError

interface ItemResult {
    rowIndex?: number
    message: string
}

interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}

export interface SyncResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

interface ProcessSheetRowParams {
    fieldTypes: CollectionFieldType[]
    row: Row
    rowIndex: number
    unsyncedRowIds: Set<string>
    slugFieldColumnIndex: number
    ignoredFieldColumnIndexes: number[]
    status: SyncStatus
}

export interface SyncMutationOptions {
    spreadsheetId: string
    sheetTitle: string
    fetchedSheet?: Sheet
    fields: ManagedCollectionField[]
    ignoredFieldColumnIndexes: number[]
    slugFieldColumnIndex: number
    colFieldTypes: CollectionFieldType[]
    lastSyncedTime: string | null
}

function getFieldValue(fieldType: CollectionFieldType, cellValue: CellValue) {
    switch (fieldType) {
        case "number": {
            const num = Number(cellValue)
            if (isNaN(num)) {
                return null
            }

            return num
        }
        case "boolean": {
            return CELL_BOOLEAN_VALUES.includes(cellValue)
        }
        case "date": {
            if (typeof cellValue !== "string") return null
            return new Date(cellValue).toUTCString()
        }
        case "enum":
        case "image":
        case "link":
        case "formattedText":
        case "color":
        case "string": {
            return String(cellValue)
        }
        default:
            return null
    }
}

function processSheetRow({
    row,
    rowIndex,
    unsyncedRowIds,
    ignoredFieldColumnIndexes,
    slugFieldColumnIndex,
    status,
    fieldTypes,
}: ProcessSheetRowParams) {
    const fieldData: Record<string, unknown> = {}
    let slugValue: string | null = null
    let itemId: string | null = null

    for (const [colIndex, cell] of row.entries()) {
        if (ignoredFieldColumnIndexes.includes(colIndex)) continue

        // +1 as zero-indexed, another +1 to account for header row
        const location = columnToLetter(colIndex + 1) + (rowIndex + 2)

        const fieldValue = getFieldValue(fieldTypes[colIndex], cell)

        if (fieldValue === null) {
            status.warnings.push({
                rowIndex,
                message: `Invalid cell value at ${location}.`,
            })
            continue
        }

        if (colIndex === slugFieldColumnIndex) {
            if (typeof fieldValue !== "string") {
                continue
            }

            slugValue = slugify(fieldValue)
            itemId = generateHashId(fieldValue)

            // Mark row as seen
            unsyncedRowIds.delete(itemId)
        }

        fieldData[colIndex] = fieldValue
    }

    if (!slugValue || !itemId) {
        status.warnings.push({
            rowIndex,
            message: "Slug or title missing. Skipping item.",
        })

        return null
    }

    return {
        id: itemId,
        slug: slugValue,
        fieldData,
    }
}

function processSheet(
    rows: Row[],
    processRowParams: Omit<ProcessSheetRowParams, "row" | "rowIndex" | "status" | "fieldType">
) {
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }
    const result = rows.map((row, rowIndex) =>
        processSheetRow({
            row,
            rowIndex,
            status,
            ...processRowParams,
        })
    )
    const collectionItems = result.filter(isDefined)

    return {
        collectionItems,
        status,
    }
}

export async function syncSheet({
    fetchedSheet,
    spreadsheetId,
    sheetTitle,
    fields,
    ignoredFieldColumnIndexes,
    slugFieldColumnIndex,
    colFieldTypes,
}: SyncMutationOptions) {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const unsyncedItemIds = new Set(await collection.getItemIds())

    const sheet = fetchedSheet ?? (await fetchSheetWithClient(spreadsheetId, sheetTitle))
    const [headerRow, ...rows] = sheet.values

    const { collectionItems, status } = processSheet(rows, {
        unsyncedRowIds: unsyncedItemIds,
        fieldTypes: colFieldTypes,
        ignoredFieldColumnIndexes,
        slugFieldColumnIndex,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await Promise.all([
        collection.setPluginData(PLUGIN_SPREADSHEET_ID_KEY, spreadsheetId),
        collection.setPluginData(PLUGIN_SHEET_TITLE_KEY, sheetTitle),
        collection.setPluginData(PLUGIN_IGNORED_FIELD_COLUMN_INDEXES_KEY, JSON.stringify(ignoredFieldColumnIndexes)),
        collection.setPluginData(PLUGIN_SLUG_INDEX_COLUMN_KEY, String(slugFieldColumnIndex)),
        collection.setPluginData(PLUGIN_SHEET_HEADER_ROW, JSON.stringify(headerRow)),
        collection.setPluginData(PLUGIN_LAST_SYNCED_KEY, new Date().toISOString()),
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

export function hasFieldConfigurationChanged(storedHeaderRow: HeaderRow, headerRow: HeaderRow): boolean {
    if (storedHeaderRow.length !== headerRow.length) {
        return false
    }

    const sortedStoredHeaderRow = [...storedHeaderRow].sort()
    const sortedHeaderRow = [...headerRow].sort()

    const isColsUnchanged = sortedStoredHeaderRow.every((value, index) => value === sortedHeaderRow[index])
    return !isColsUnchanged
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()
    const tokens = await auth.getTokens()
    const isAuthenticated = !!tokens

    const spreadsheetId = await collection.getPluginData(PLUGIN_SPREADSHEET_ID_KEY)
    const sheetTitle = await collection.getPluginData(PLUGIN_SHEET_TITLE_KEY)

    if (!spreadsheetId || !sheetTitle || !isAuthenticated) {
        return {
            type: "new",
            collection,
            isAuthenticated,
        }
    }

    const [rawIgnoredFieldColumnIndexes, rawSlugFieldColumnIndex, rawSheetHeaderRow, lastSyncedTime] =
        await Promise.all([
            collection.getPluginData(PLUGIN_IGNORED_FIELD_COLUMN_INDEXES_KEY),
            collection.getPluginData(PLUGIN_SLUG_INDEX_COLUMN_KEY),
            collection.getPluginData(PLUGIN_SHEET_HEADER_ROW),
            collection.getPluginData(PLUGIN_LAST_SYNCED_KEY),
        ])
    const ignoredFieldColumnIndexes = parseStringToArray<number>(rawIgnoredFieldColumnIndexes, "number")
    const sheetHeaderRow = parseStringToArray<string>(rawSheetHeaderRow, "string")
    const slugFieldColumnIndex = Number(rawSlugFieldColumnIndex)

    const sheet = await fetchSheetWithClient(spreadsheetId, sheetTitle).catch(() => {
        throw new Error("Failed to fetch sheet. Do you not have permissions to view the sheet?")
    })

    assert(lastSyncedTime, "Expected last synced time to be set")

    return {
        type: "update",
        isAuthenticated,
        spreadsheetId,
        sheetTitle,
        collection,
        slugFieldColumnIndex,
        ignoredFieldColumnIndexes,
        sheet,
        lastSyncedTime,
        collectionFields,
        sheetHeaderRow,
        hasChangedFields: hasFieldConfigurationChanged(sheetHeaderRow, sheet.values[0]),
    }
}

export const useSyncSheetMutation = ({
    onSuccess,
    onError,
}: {
    onSuccess?: (result: SyncResult) => void
    onError?: (e: Error) => void
}) => {
    return useMutation({
        mutationFn: (args: SyncMutationOptions) => syncSheet(args),
        onSuccess,
        onError,
    })
}
