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
import { assert, columnToLetter, generateHashId, generateUniqueNames, isDefined, listFormatter, slugify } from "./utils"

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
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})?)?$/

interface GoogleApiErrorResponse {
    error?: {
        message?: string
        status?: string
    }
}

class GoogleSheetsApiError extends Error {
    constructor(
        message: string,
        public readonly status?: string
    ) {
        super(message)
        this.name = "GoogleSheetsApiError"
    }
}

function isGoogleSheetsApiError(error: unknown): error is GoogleSheetsApiError {
    return error instanceof GoogleSheetsApiError
}

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

export type CellValue = string | number | boolean | null

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
        const errorData = json as GoogleApiErrorResponse
        const errorMessage = errorData.error?.message || "Unknown error"
        const errorStatus = errorData.error?.status

        throw new GoogleSheetsApiError(errorMessage, errorStatus)
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
    const query = useQuery<SpreadsheetInfo>({
        queryKey: ["spreadsheet", spreadsheetId],
        queryFn: () => fetchSpreadsheetInfo(spreadsheetId),
        enabled: !!spreadsheetId,
    })

    return {
        ...query,
        errorStatus: isGoogleSheetsApiError(query.error) ? query.error.status : undefined,
        errorMessage: isGoogleSheetsApiError(query.error) ? query.error.message : undefined,
    }
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
    errorStatus?: string
    errorMessage?: string
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
    columnCount: number
    uniqueHeaderRowNames: string[]
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

/**
 * Validates if a string is a valid ISO date format.
 * Returns true if valid, false otherwise.
 */
function isValidISODate(dateString: string): boolean {
    try {
        // Check if the string matches basic ISO 8601 format patterns
        if (!ISO_DATE_REGEX.test(dateString)) return false

        const date = new Date(dateString)
        return !isNaN(date.getTime())
    } catch {
        return false
    }
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
            return isDefined(cellValue) ? { type, value: CELL_BOOLEAN_VALUES.includes(cellValue) } : null
        }
        case "date": {
            // Google Sheets numeric date values (Lotus 1-2-3 format)
            if (typeof cellValue === "number") {
                try {
                    const date = extractDateFromSerialNumber(cellValue)
                    return { type, value: date.toISOString() }
                } catch {
                    return null
                }
            }

            // ISO date format
            if (typeof cellValue === "string" && isValidISODate(cellValue)) {
                return { type, value: cellValue }
            }

            return null
        }
        case "image":
        case "link":
        case "file":
        case "formattedText":
        case "color":
        case "string": {
            if (!isDefined(cellValue)) return null
            return { type, value: String(cellValue) }
        }
        default:
            return null
    }
}

function processSheetRow({
    row,
    rowIndex,
    columnCount,
    uniqueHeaderRowNames,
    ignoredFieldColumnIndexes,
    slugFieldColumnIndex,
    status,
    fieldTypes,
}: ProcessSheetRowParams) {
    const fieldData: FieldDataInput = {}
    let slugValue: string | null = null
    let itemId: string | null = null

    for (let i = 0; i < columnCount; i++) {
        const cell = row[i] ?? null

        const fieldType = fieldTypes[i]
        if (!fieldType) continue

        // Skip processing ignored columns unless they are the slug field
        const isIgnored = ignoredFieldColumnIndexes.includes(i)
        const isSlugField = i === slugFieldColumnIndex

        if (isIgnored && !isSlugField) continue

        let fieldDataEntryInput = getFieldDataEntryInput(fieldType, cell)

        // Set to default value for type if no value is provided
        if (!fieldDataEntryInput) {
            switch (fieldType) {
                case "string":
                case "formattedText":
                    fieldDataEntryInput = {
                        value: "",
                        type: fieldType,
                    }
                    break
                case "boolean":
                    fieldDataEntryInput = {
                        value: false,
                        type: "boolean",
                    }
                    break
                case "number":
                    fieldDataEntryInput = {
                        value: 0,
                        type: "number",
                    }
                    break
                case "image":
                case "file":
                case "link":
                case "date":
                case "color":
                    fieldDataEntryInput = {
                        value: null,
                        type: fieldType,
                    }
                    break
            }
        }

        if (!fieldDataEntryInput) {
            // +1 as zero-indexed, another +1 to account for header row
            const location = `${columnToLetter(i + 1)}${rowIndex + 2}`

            status.warnings.push({
                rowIndex,
                message: `Invalid cell value at ${location}.`,
            })
            continue
        }

        // Always process the slug column, even if it's ignored
        if (isSlugField) {
            if (typeof fieldDataEntryInput.value !== "string") {
                continue
            }

            slugValue = slugify(fieldDataEntryInput.value)
            itemId = generateHashId(fieldDataEntryInput.value)
        }

        if (isIgnored) continue

        const fieldName = uniqueHeaderRowNames[i]
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

function processSheet(rows: Row[], processRowParams: Omit<ProcessSheetRowParams, "row" | "rowIndex" | "status">) {
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

    // Find duplicate slugs and report error if any are found
    const seenSlugs = new Set<string>()
    const duplicateSlugs = new Set<string>()

    for (const item of collectionItems) {
        if (seenSlugs.has(item.slug)) {
            duplicateSlugs.add(item.slug)
        } else {
            seenSlugs.add(item.slug)
        }
    }

    if (duplicateSlugs.size > 0) {
        const slugList = listFormatter.format(Array.from(duplicateSlugs))
        const pluralSuffix = duplicateSlugs.size > 1 ? "s" : ""
        throw new Error(`Duplicate slug${pluralSuffix} found: ${slugList}. Each item must have a unique slug.`)
    }

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

    const sheet = fetchedSheet ?? (await fetchSheetWithClient(spreadsheetId, sheetTitle))
    const [headerRow, ...rows] = sheet.values

    const uniqueHeaderRowNames = generateUniqueNames(headerRow)
    const headerRowHash = generateHeaderRowHash(headerRow, ignoredColumns)

    // Find the longest row length to check if any sheet rows are longer than the header row
    const maxRowLength = Math.max(...sheet.values.map(row => row.length))

    // Check for empty header row cells and collect all empty columns
    const emptyHeaderColumns: string[] = []
    for (let i = 0; i < maxRowLength; i++) {
        const header = headerRow[i]
        if (!isDefined(header) || header.trim() === "") {
            const columnLetter = columnToLetter(i + 1)
            emptyHeaderColumns.push(columnLetter)
        }
    }

    // Throw error if any empty header columns were found
    if (emptyHeaderColumns.length > 0) {
        const columnList = listFormatter.format(emptyHeaderColumns)
        const pluralSuffix = emptyHeaderColumns.length > 1 ? "s" : ""
        throw new Error(
            `Empty header cell${pluralSuffix} found in column${pluralSuffix} ${columnList}. All header row cells must contain values.`
        )
    }

    const { collectionItems, status } = processSheet(rows, {
        uniqueHeaderRowNames,
        fieldTypes: colFieldTypes,
        ignoredFieldColumnIndexes: ignoredColumns.map(col => uniqueHeaderRowNames.indexOf(col)),
        slugFieldColumnIndex: slugColumn ? uniqueHeaderRowNames.indexOf(slugColumn) : -1,
        columnCount: headerRow.length,
    })

    // Calculate items to delete based on what's in the collection vs what we processed
    const existingItemIds = new Set(await collection.getItemIds())
    const processedItemIds = new Set(collectionItems.map(item => item.id))
    const itemsToDelete = Array.from(existingItemIds).filter(id => !processedItemIds.has(id))

    if (itemsToDelete.length > 0) {
        await collection.removeItems(itemsToDelete)
    }

    if (collectionItems.length > 0) {
        await collection.addItems(collectionItems)
        await collection.setItemOrder(collectionItems.map(collectionItem => collectionItem.id))
    }

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
        return {
            type: "no-sheet-access",
            spreadsheetId,
            errorStatus: isGoogleSheetsApiError(error) ? error.status : undefined,
            errorMessage: isGoogleSheetsApiError(error) ? error.message : undefined,
        }
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
