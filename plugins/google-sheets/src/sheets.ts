import { useMutation, useQuery } from "@tanstack/react-query"
import {
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
} from "framer-plugin"
import auth from "./auth"
import { type DataSource } from "./data"
import { logSyncResult } from "./debug"
import { queryClient } from "./main"
import {
    assert,
    columnToLetter,
    generateHashId,
    generateUniqueNames,
    isDefined,
    parseStringToArray,
    slugify,
} from "./utils"

const USER_INFO_API_URL = "https://www.googleapis.com/oauth2/v1"
const SHEETS_API_URL = "https://sheets.googleapis.com/v4"
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3"

const PLUGIN_SPREADSHEET_ID_KEY = "sheetsPluginSpreadsheetId"
const PLUGIN_SHEET_ID_KEY = "sheetsPluginSheetId"
const PLUGIN_LAST_SYNCED_KEY = "sheetsPluginLastSynced"
const PLUGIN_IGNORED_COLUMNS_KEY = "sheetsPluginIgnoredColumns"
const PLUGIN_SHEET_HEADER_ROW_HASH_KEY = "sheetsPluginSheetHeaderRowHash"
const PLUGIN_SLUG_COLUMN_KEY = "sheetsPluginSlugColumn"

/** @deprecated - use PLUGIN_SHEET_ID_KEY instead */
const DO_NOT_USE_ME_PLUGIN_SHEET_TITLE_KEY = "sheetsPluginSheetTitle"
/** @deprecated - use PLUGIN_SHEET_HEADER_ROW_HASH_KEY instead  */
const DO_NOT_USE_ME_PLUGIN_SHEET_HEADER_ROW_KEY = "sheetsPluginSheetHeaderRow"
/** @deprecated - use PLUGIN_IGNORED_COLUMNS_KEY instead */
const DO_NOT_USE_ME_PLUGIN_IGNORED_FIELD_COLUMN_INDEXES_KEY = "sheetsPluginIgnoredFieldColumnIndexes"
/** @deprecated - use PLUGIN_SLUG_COLUMN_KEY instead */
const DO_NOT_USE_ME_PLUGIN_SLUG_INDEX_COLUMN_KEY = "sheetsPluginSlugIndexColumn"

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

export type CellValue = string | number | boolean | undefined

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

const request = async <T = unknown>({ path, service = "sheets", method = "get", query, body }: RequestOptions) => {
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

function fetchUserInfo() {
    return request<UserInfo>({
        service: "oauth",
        path: `/userinfo`,
    })
}

export function fetchSpreadsheetInfo(spreadsheetId: string) {
    return request<SpreadsheetInfo>({
        path: `/spreadsheets/${spreadsheetId}`,
        query: {
            includeGridData: "true",
            fields: "spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title,sheets.properties.sheetId",
        },
    })
}

function fetchSheet(spreadsheetId: string, sheetTitle: string, range?: string) {
    return request<Sheet>({
        path: `/spreadsheets/${spreadsheetId}/values/${sheetTitle}`,
        query: {
            range: range ?? sheetTitle,
            valueRenderOption: "UNFORMATTED_VALUE",
            dateTimeRenderOption: "SERIAL_NUMBER",
        },
    })
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

export function fetchSheetWithClient(spreadsheetId: string, sheetTitle: string, range?: string) {
    return queryClient.fetchQuery({
        queryKey: ["sheet", spreadsheetId, sheetTitle, range],
        queryFn: () => fetchSheet(spreadsheetId, sheetTitle, range),
    })
}

export type CollectionFieldType = ManagedCollectionFieldInput["type"]

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
    fieldTypes: Record<string, CollectionFieldType>
    row: Row
    rowIndex: number
    uniqueHeaderRowNames: string[]
    unsyncedItemIds: Set<string>
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
    unsyncedItemIds,
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
        const location = columnToLetter(colIndex + 1) + (rowIndex + 2)

        const currentFieldName = uniqueHeaderRowNames[colIndex]
        assert(isDefined(currentFieldName), "Field name must be defined")

        const fieldType = fieldTypes[currentFieldName]
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
            unsyncedItemIds.delete(itemId)
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

export function processSheet(
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

export function generateHeaderRowHash(headerRow: HeaderRow, ignoredColumns: string[]) {
    return generateHashId(
        [...headerRow]
            .filter(field => !ignoredColumns.includes(field))
            .sort()
            .join(HEADER_ROW_DELIMITER)
    )
}

const inferFieldType = (cellValue: CellValue): CollectionFieldType => {
    if (typeof cellValue === "boolean") return "boolean"
    if (typeof cellValue === "number") return "number"

    if (typeof cellValue === "string") {
        const cellValueTrimmed = cellValue.trim()
        const cellValueLowered = cellValueTrimmed.toLowerCase()

        // If the cell value contains a newline, it's probably a formatted text field
        if (cellValueLowered.includes("\n")) return "formattedText"
        if (/<[a-z][\s\S]*>/.test(cellValueLowered)) return "formattedText"

        // Check if the string is an ISO date
        // Accepts formats like 2023-01-01, 2023-01-01T12:34:56Z, 2023-01-01T12:34:56.789+02:00, etc.
        if (/^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-Zz]*)?$/.test(cellValueTrimmed) && !isNaN(Date.parse(cellValueTrimmed))) {
            return "date"
        }

        // Detect hex, rgb(), and rgba() CSS color formats
        if (
            /^#[0-9a-f]{6}$/.test(cellValueLowered) ||
            /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:\d*\.?\d+|\d+%))?\s*\)$/i.test(cellValueTrimmed)
        ) {
            return "color"
        }

        try {
            new URL(cellValueLowered)

            if (/\.(gif|jpe?g|png|apng|svg|webp)$/i.test(cellValueLowered)) return "image"

            return "link"
        } catch (e) {
            return "string"
        }
    }

    return "string"
}

const getFieldType = (
    collectionFields: ManagedCollectionFieldInput[],
    columnId: string,
    cellValue?: CellValue
): CollectionFieldType => {
    // Determine if the field type is already configured
    if (collectionFields.length > 0) {
        const field = collectionFields.find(field => field.id === columnId)
        return field?.type ?? "string"
    }

    // Otherwise, infer the field type from the cell value
    return cellValue !== undefined ? inferFieldType(cellValue) : "string"
}

export function getFields(dataSource: DataSource, collectionFields: ManagedCollectionFieldInput[]) {
    const [headerRow, ...rows] = dataSource.sheetRows || []
    const row = rows[0]

    if (!headerRow) {
        return []
    }

    const nameCount = new Map<string, number>()
    const uniqueColumnNames = headerRow.map(nameValue => {
        const name = String(nameValue)
        const count = nameCount.get(name) || 0
        nameCount.set(name, count + 1)

        return count > 0 ? `${name} ${count + 1}` : name
    })

    return headerRow.map((_, columnIndex) => {
        const sanitizedName = uniqueColumnNames[columnIndex]
        assert(sanitizedName, "Sanitized name is undefined")

        return {
            id: sanitizedName,
            name: sanitizedName,
            type: getFieldType(collectionFields, sanitizedName, row?.[columnIndex] ?? undefined),
        } as ManagedCollectionFieldInput
    })
}
