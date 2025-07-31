import { useMutation, useQuery } from "@tanstack/react-query"
import {
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
} from "framer-plugin"
import * as v from "valibot"
import auth from "./auth"
import { logSyncResult } from "./debug.ts"
import { queryClient } from "./main.tsx"
import { assert, columnToLetter, generateHashId, generateUniqueNames, isDefined, slugify } from "./utils"

const USER_INFO_API_URL = "https://www.googleapis.com/oauth2/v1"
const SHEETS_API_URL = "https://sheets.googleapis.com/v4"
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3"

const PLUGIN_SPREADSHEET_ID_KEY = "sheetsPluginSpreadsheetId"
const PLUGIN_SHEET_ID_KEY = "sheetsPluginSheetId"
const PLUGIN_LAST_SYNCED_KEY = "sheetsPluginLastSynced"
const PLUGIN_IGNORED_COLUMNS_KEY = "sheetsPluginIgnoredColumns"
const PLUGIN_SHEET_HEADER_ROW_HASH_KEY = "sheetsPluginSheetHeaderRowHash"
const PLUGIN_SLUG_COLUMN_KEY = "sheetsPluginSlugColumn"

const CELL_BOOLEAN_VALUES = ["Y", "yes", "true", "TRUE", "Yes", 1, true]
const HEADER_ROW_DELIMITER = "OIhpKTpp"

interface UserInfo {
    displayName: string
}

interface SpreadsheetInfoProperties {
    title: string
}

interface SheetProperties {
    sheetId: number
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
    service?: "drive" | "sheets" | "oauth"
    query?: QueryParams
    body?: Record<string, unknown>
}

const request = async ({ path, service = "sheets", method = "get", query, body }: RequestOptions): Promise<unknown> => {
    const tokens = await auth.getTokens()

    if (!tokens) {
        throw new Error("Invalid authentication.")
    }

    let serviceUrl
    switch (service) {
        case "oauth":
            serviceUrl = USER_INFO_API_URL
            break
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
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
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

    const json = (await res.json()) as unknown

    if (!res.ok) {
        const errorMessage = (json as { error: { message: string } }).error.message
        throw new Error("Failed to fetch Google Sheets API: " + errorMessage)
    }

    return json
}

async function fetchUserInfo(): Promise<UserInfo> {
    return request({
        service: "oauth",
        path: `/userinfo`,
    }) as Promise<UserInfo>
}

async function fetchSpreadsheetInfo(spreadsheetId: string): Promise<SpreadsheetInfo> {
    return request({
        path: `/spreadsheets/${spreadsheetId}`,
        query: {
            includeGridData: "true",
            fields: "spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title,sheets.properties.sheetId",
        },
    }) as Promise<SpreadsheetInfo>
}

async function fetchSheet(spreadsheetId: string, sheetTitle: string, range?: string): Promise<Sheet> {
    return request({
        path: `/spreadsheets/${spreadsheetId}/values/${sheetTitle}`,
        query: {
            range: range ?? sheetTitle,
            valueRenderOption: "UNFORMATTED_VALUE",
            dateTimeRenderOption: "SERIAL_NUMBER",
        },
    }) as Promise<Sheet>
}

export const useFetchUserInfo = () => {
    return useQuery<UserInfo>({
        queryKey: ["userInfo"],
        queryFn: () => fetchUserInfo(),
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

export type CollectionFieldType = ManagedCollectionFieldInput["type"]

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    isAuthenticated: boolean
}

export interface PluginContextUpdate {
    type: "update"
    spreadsheetId: string
    sheetTitle: string
    collectionFields: ManagedCollectionFieldInput[]
    collection: ManagedCollection
    hasChangedFields: boolean
    ignoredColumns: string[]
    slugColumn: string | null
    isAuthenticated: boolean
    sheet: Sheet
    lastSyncedTime: string
    sheetHeaderRow: string[]
}

export interface PluginContextNoSheetAccess {
    type: "no-sheet-access"
    spreadsheetId: string
}

export interface PluginContextSheetByTitleMissing {
    type: "sheet-by-title-missing"
    spreadsheetId: string
    title: string
}

export type PluginContext =
    | PluginContextNew
    | PluginContextUpdate
    | PluginContextNoSheetAccess
    | PluginContextSheetByTitleMissing

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
    uniqueHeaderRowNames: string[]
    unsyncedRowIds: Set<string>
    slugFieldColumnIndex: number
    ignoredFieldColumnIndexes: number[]
    status: SyncStatus
}

export interface SyncMutationOptions {
    spreadsheetId: string
    sheetTitle: string
    fetchedSheet?: Sheet
    fields: ManagedCollectionFieldInput[]
    slugColumn: string | null
    ignoredColumns: string[]
    colFieldTypes: CollectionFieldType[]
    lastSyncedTime: string | null
}

const BASE_DATE_1900 = new Date(Date.UTC(1899, 11, 30))
const BASE_DATE_1904 = new Date(Date.UTC(1904, 0, 1))
const MS_PER_DAY = 24 * 60 * 60 * 1000 // hours * minutes * seconds * milliseconds

/**
 * Extracts a date from a serial number in Lotus 1-2-3 date representation.
 */
function extractDateFromSerialNumber(serialNumber: number) {
    // Use 1900 system by default, but if date is before 1904,
    // switch to 1904 system
    let baseDate = BASE_DATE_1900
    const date1900 = new Date(BASE_DATE_1900.getTime() + serialNumber * MS_PER_DAY)

    if (date1900 < BASE_DATE_1904) {
        baseDate = BASE_DATE_1904
    }

    const wholeDays = Math.floor(serialNumber)
    const fractionalDay = serialNumber - wholeDays
    const milliseconds = Math.round(fractionalDay * MS_PER_DAY)

    return new Date(baseDate.getTime() + wholeDays * MS_PER_DAY + milliseconds)
}

function getFieldDataEntryInput(type: CollectionFieldType, cellValue: CellValue): FieldDataEntryInput | null {
    switch (type) {
        case "number": {
            const num = Number(cellValue)
            if (Number.isNaN(num)) {
                return null
            }

            return { type, value: num }
        }
        case "boolean": {
            return { type, value: CELL_BOOLEAN_VALUES.includes(cellValue) }
        }
        case "date": {
            if (typeof cellValue !== "number") return null
            try {
                const date = extractDateFromSerialNumber(cellValue)
                return { type, value: date.toISOString() }
            } catch {
                return null
            }
        }
        case "enum":
        case "image":
        case "link":
        case "formattedText":
        case "color":
        case "string": {
            return { type, value: String(cellValue) }
        }
        default:
            return null
    }
}

function processSheetRow({
    row,
    rowIndex,
    unsyncedRowIds,
    uniqueHeaderRowNames,
    ignoredFieldColumnIndexes,
    slugFieldColumnIndex,
    status,
    fieldTypes,
}: ProcessSheetRowParams) {
    const fieldData: FieldDataInput = {}
    let slugValue: string | null = null
    let itemId: string | null = null

    for (const [colIndex, cell] of row.entries()) {
        if (ignoredFieldColumnIndexes.includes(colIndex)) continue

        // +1 as zero-indexed, another +1 to account for header row
        const location = `${columnToLetter(colIndex + 1)}${rowIndex + 2}`

        const fieldType = fieldTypes[colIndex]
        assert(isDefined(fieldType), "Field type must be defined")

        const fieldDataEntryInput = getFieldDataEntryInput(fieldType, cell)

        if (fieldDataEntryInput === null) {
            status.warnings.push({
                rowIndex,
                message: `Invalid cell value at ${location}.`,
            })
            continue
        }

        if (colIndex === slugFieldColumnIndex) {
            if (typeof fieldDataEntryInput.value !== "string") {
                continue
            }

            slugValue = slugify(fieldDataEntryInput.value)
            itemId = generateHashId(fieldDataEntryInput.value)

            // Mark row as seen
            unsyncedRowIds.delete(itemId)
        }

        const fieldName = uniqueHeaderRowNames[colIndex]
        assert(isDefined(fieldName), "Field name must be defined")

        fieldData[fieldName] = fieldDataEntryInput
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

function generateHeaderRowHash(headerRow: HeaderRow, ignoredColumns: string[]) {
    return generateHashId(
        [...headerRow]
            .filter(field => !ignoredColumns.includes(field))
            .sort()
            .join(HEADER_ROW_DELIMITER)
    )
}

export async function syncSheet({
    fetchedSheet,
    spreadsheetId,
    sheetTitle,
    fields,
    ignoredColumns,
    slugColumn,
    colFieldTypes,
}: SyncMutationOptions) {
    if (fields.length === 0) {
        throw new Error("Expected to have at least one field selected to sync.")
    }

    const collection = await framer.getActiveManagedCollection()

    const unsyncedItemIds = new Set(await collection.getItemIds())

    const sheet = fetchedSheet ?? (await fetchSheetWithClient(spreadsheetId, sheetTitle))
    const [headerRow, ...rows] = sheet.values

    const uniqueHeaderRowNames = generateUniqueNames(headerRow)
    const headerRowHash = generateHeaderRowHash(headerRow, ignoredColumns)

    const { collectionItems, status } = processSheet(rows, {
        uniqueHeaderRowNames,
        unsyncedRowIds: unsyncedItemIds,
        fieldTypes: colFieldTypes,
        ignoredFieldColumnIndexes: ignoredColumns.map(col => uniqueHeaderRowNames.indexOf(col)),
        slugFieldColumnIndex: slugColumn ? uniqueHeaderRowNames.indexOf(slugColumn) : -1,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)
    await collection.setItemOrder(collectionItems.map(collectionItem => collectionItem.id))

    const spreadsheetInfo = await fetchSpreadsheetInfo(spreadsheetId)
    const sheetId = spreadsheetInfo.sheets.find(x => x.properties.title === sheetTitle)?.properties.sheetId
    assert(sheetId !== undefined, "Expected sheet ID to be defined")

    await Promise.all([
        collection.setPluginData(PLUGIN_SPREADSHEET_ID_KEY, spreadsheetId),
        collection.setPluginData(PLUGIN_SHEET_ID_KEY, sheetId.toString()),
        collection.setPluginData(PLUGIN_IGNORED_COLUMNS_KEY, JSON.stringify(ignoredColumns)),
        collection.setPluginData(PLUGIN_SHEET_HEADER_ROW_HASH_KEY, headerRowHash),
        collection.setPluginData(PLUGIN_SLUG_COLUMN_KEY, slugColumn),
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

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getActiveManagedCollection()
    let collectionFields = await collection.getFields()

    const tokens = await auth.getTokens()
    const isAuthenticated = !!tokens

    const spreadsheetId = await collection.getPluginData(PLUGIN_SPREADSHEET_ID_KEY)
    const storedSheetId = await collection.getPluginData(PLUGIN_SHEET_ID_KEY)

    if (!spreadsheetId || storedSheetId === null || !isAuthenticated) {
        return {
            type: "new",
            collection,
            isAuthenticated,
        }
    }

    // Fetch both new and legacy data
    const [rawIgnoredColumns, rawSheetHeaderRowHash, storedSlugColumn, lastSyncedTime] = await Promise.all([
        collection.getPluginData(PLUGIN_IGNORED_COLUMNS_KEY),
        collection.getPluginData(PLUGIN_SHEET_HEADER_ROW_HASH_KEY),
        collection.getPluginData(PLUGIN_SLUG_COLUMN_KEY),
        collection.getPluginData(PLUGIN_LAST_SYNCED_KEY),
    ])

    let spreadsheetInfo

    try {
        spreadsheetInfo = await fetchSpreadsheetInfo(spreadsheetId)
    } catch (error) {
        return { type: "no-sheet-access", spreadsheetId }
    }

    const sheetId = parseInt(storedSheetId)

    const sheetTitle = spreadsheetInfo.sheets.find(x => x.properties.sheetId === sheetId)?.properties.title
    assert(sheetTitle !== undefined, "Expected sheet title to be defined")

    const sheet = await fetchSheetWithClient(spreadsheetId, sheetTitle)
    assert(lastSyncedTime, "Expected last synced time to be set")

    // Sheet ID never leaves here because Google offers slightly better API
    // ergonomics when you refer to sheets by their titles, so that's what we
    // do. This plugin doesn't remain open for long, so it's unlikely that
    // somebody renames their sheet during that short window. If that assumption
    // turns out to be false too often - switch to batchGetByDataFilter +
    // GridRange and drop titles altogether.

    const sheetHeaderRow = sheet.values[0]

    let slugColumn: string | null = null
    let ignoredColumns: string[] = []

    // If we don't have ignored columns or slug column, we need to update the
    // collection fields and plugin data.
    if (!rawIgnoredColumns || !storedSlugColumn) {
        const uniqueHeaderRowNames = generateUniqueNames(sheetHeaderRow)

        collectionFields = collectionFields.map((field, index) => ({
            ...field,
            id: uniqueHeaderRowNames.find(name => name === field.name) ?? uniqueHeaderRowNames[index] ?? field.name,
        }))
    } else {
        slugColumn = storedSlugColumn
        const result = v.safeParse(v.pipe(v.string(), v.parseJson(), v.array(v.string())), rawIgnoredColumns)

        if (result.success) {
            ignoredColumns = result.output
        } else if (framer.isAllowedTo("ManagedCollection.setPluginData")) {
            ignoredColumns = await salvageIgnoredColumns(rawIgnoredColumns, ignoredColumns =>
                collection.setPluginData(PLUGIN_IGNORED_COLUMNS_KEY, JSON.stringify(ignoredColumns))
            )

            // Notify the user to be sure they're aware of the issue, to be sure they acknowledge it make it persistent
            framer.notify("Some columns couldn’t be restored. Please review your ignored columns in Manage.", {
                variant: "warning",
                durationMs: Infinity,
            })
        } else {
            ignoredColumns = []

            framer.notify("Configuration of ignored columns is invalid. You need write permissions to fix it.", {
                variant: "error",
            })
        }
    }

    // We should not hash ignored fields since they are not synced to Framer,
    // and we don't want to trigger a re-sync of the sheet.
    const currentSheetHeaderRowHash = generateHeaderRowHash(sheetHeaderRow, ignoredColumns)
    const storedSheetHeaderRowHash = rawSheetHeaderRowHash ?? ""

    // If the order of the columns has changed, we need to reorder the collection fields
    if (storedSheetHeaderRowHash && collectionFields.length > 0) {
        const reorderedCollectionFields = []

        for (const fieldId of sheetHeaderRow) {
            const field = collectionFields.find(field => field.id === fieldId)

            if (field) {
                reorderedCollectionFields.push(field)
            }
        }

        collectionFields = reorderedCollectionFields
    }

    // If the stored slug column is not in the spreadsheet header row, we need to update it
    if (slugColumn && !sheetHeaderRow.includes(slugColumn)) {
        slugColumn = null
    }

    return {
        type: "update",
        isAuthenticated,
        spreadsheetId,
        sheetTitle,
        collection,
        slugColumn,
        sheet,
        lastSyncedTime,
        collectionFields,
        sheetHeaderRow,
        ignoredColumns,
        hasChangedFields: storedSheetHeaderRowHash !== currentSheetHeaderRowHash,
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
        mutationFn: async (args: SyncMutationOptions) => {
            const collection = await framer.getActiveManagedCollection()
            await collection.setFields(args.fields)
            return await syncSheet(args)
        },
        onSuccess,
        onError,
    })
}

async function salvageIgnoredColumns(
    rawIgnoredColumns: unknown,
    setIgnoredColumns: (ignoredColumns: string[]) => Promise<void>
): Promise<string[]> {
    let result: string[]

    const atLeastAnArrayResult = v.safeParse(v.pipe(v.string(), v.parseJson(), v.array(v.unknown())), rawIgnoredColumns)

    if (atLeastAnArrayResult.success) {
        result = atLeastAnArrayResult.output.filter(i => typeof i === "string")
    } else {
        result = []
    }

    await setIgnoredColumns(result)

    return result
}
