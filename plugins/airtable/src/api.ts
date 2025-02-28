import auth from "./auth"

interface AirtableBaseEntity {
    id: string
    name: string
}

type FieldId = string

type PermissionLevel = "none" | "read" | "comment" | "edit" | "create"

interface Choice extends AirtableBaseEntity {
    color?: string
}

interface CollaboratorValue extends AirtableBaseEntity {
    email?: string
    permissionLevel?: PermissionLevel
}

interface Thumbnail {
    url: string
    width: number
    height: number
}

interface AttachmentValue {
    id: string
    url: string
    filename: string
    size: number
    type: string
    width?: number
    height?: number
    thumbnails?: {
        small?: Thumbnail
        large?: Thumbnail
        full?: Thumbnail
    }
}

type SingleLineTextValue = string
type EmailValue = string
type UrlValue = string
type MultilineTextValue = string
type NumberValue = number
type PercentValue = number
type CurrencyValue = number
type CheckboxValue = boolean
type FormulaValue = string | number | boolean | Array<string | number>
type CreatedTimeValue = string
type RollupValue = string | number | boolean
type CountValue = number
type DateValue = string
type DateTimeValue = string
type PhoneNumberValue = string
type LookupValue = Array<string | number | boolean>
type SingleSelectValue = string | Choice
type MultipleSelectsValue = string[] | Choice[]
type SingleCollaboratorValue = CollaboratorValue
type MultipleCollaboratorsValue = CollaboratorValue[]
type MultipleRecordLinksValue = string[] | AirtableBaseEntity[]
type MultipleAttachmentsValue = AttachmentValue[]
type AutoNumberValue = number
type BarcodeValue = { type?: string | null; text: string }
type RatingValue = number
type RichTextValue = string
type DurationValue = number
type LastModifiedTimeValue = string
type ButtonValue = { label: string; url: string | null }
type CreatedByValue = CollaboratorValue
type LastModifiedByValue = CollaboratorValue
type ExternalSyncSourceValue = Choice
type MultipleLookupValuesValue = {
    valuesByLinkedRecordId: Record<string, unknown[]>
    linkedRecordIds: string[]
}
type AiTextValue = {
    state: "empty" | "loading" | "generated" | "error"
    value: string | null
    isStale: boolean
    errorType?: string
}

export type AirtableFieldValues = {
    singleLineText: SingleLineTextValue
    email: EmailValue
    url: UrlValue
    multilineText: MultilineTextValue
    number: NumberValue
    percent: PercentValue
    currency: CurrencyValue
    singleSelect: SingleSelectValue
    multipleSelects: MultipleSelectsValue
    singleCollaborator: SingleCollaboratorValue
    multipleCollaborators: MultipleCollaboratorsValue
    multipleRecordLinks: MultipleRecordLinksValue
    date: DateValue
    dateTime: DateTimeValue
    phoneNumber: PhoneNumberValue
    multipleAttachments: MultipleAttachmentsValue
    checkbox: CheckboxValue
    formula: FormulaValue
    createdTime: CreatedTimeValue
    rollup: RollupValue
    count: CountValue
    lookup: LookupValue
    multipleLookupValues: MultipleLookupValuesValue
    autoNumber: AutoNumberValue
    barcode: BarcodeValue
    rating: RatingValue
    richText: RichTextValue
    duration: DurationValue
    lastModifiedTime: LastModifiedTimeValue
    button: ButtonValue
    createdBy: CreatedByValue
    lastModifiedBy: LastModifiedByValue
    externalSyncSource: ExternalSyncSourceValue
    aiText: AiTextValue
}

export type AirtableFieldType = keyof AirtableFieldValues

export type AirtableFieldValue = AirtableFieldValues[AirtableFieldType]

interface NumberOption {
    precision: number
}

interface PercentOption {
    precision: number
}

interface CurrencyOption {
    precision: number
    symbol: string
}

interface SelectOption {
    choices: Choice[]
}

interface MultipleRecordLinksOption {
    linkedTableId: string
    prefersSingleRecordLink: boolean
    inverseLinkFieldId?: string
    viewIdForRecordSelection?: string
}

interface DateFormatOption {
    format: "l" | "LL" | "M/D/YYYY" | "D/M/YYYY" | "YYYY-MM-DD"
    name: "local" | "friendly" | "us" | "european" | "iso"
}

interface DateOption {
    dateFormat: DateFormatOption
}

interface TimeFormatOption {
    format: "h:mma" | "HH:mm"
    name: "12hour" | "24hour"
}

interface DateTimeOption {
    dateFormat: DateFormatOption
    timeFormat: TimeFormatOption
    timeZone: string
}

interface MultipleAttachmentsOption {
    isReversed: boolean
}

interface CheckboxOption {
    icon: "check" | "xCheckbox" | "star" | "heart" | "thumbsUp" | "flag" | "dot"
    color:
        | "greenBright"
        | "tealBright"
        | "cyanBright"
        | "blueBright"
        | "purpleBright"
        | "pinkBright"
        | "redBright"
        | "orangeBright"
        | "yellowBright"
        | "grayBright"
}

interface FormulaOption {
    formula: string
    referencedFieldIds: string[] | null
    result: {
        type: AirtableFieldType
    } | null
}

interface RollupOption {
    fieldIdInLinkedTable?: string
    recordLinkFieldId?: string
    result?: AirtableFieldType | null
    referencedFieldIds?: string[]
}

interface CountOption {
    isValid: boolean
    recordLinkFieldId?: string | null
}

interface LookupOption {
    fieldIdInLinkedTable: string | null
    recordLinkFieldId: string | null
    result: AirtableFieldType | null
}

interface RatingOption {
    max: number
    icon: "star" | "heart" | "thumbsUp" | "flag" | "dot"
    color:
        | "yellowBright"
        | "orangeBright"
        | "redBright"
        | "pinkBright"
        | "purpleBright"
        | "blueBright"
        | "cyanBright"
        | "tealBright"
        | "greenBright"
        | "grayBright"
}

type DurationOption = {
    durationFormat: "h:mm" | "h:mm:ss" | "h:mm:ss.S" | "h:mm:ss.SS" | "h:mm:ss.SSS"
}

type LastModifiedTimeOption = {
    isValid: boolean
    referencedFieldIds: string[] | null
    result: "date" | "dateTime" | null
}

type AiTextOption = {
    prompt?: (string | { field: { fieldId: string; referencedFieldIds?: string[] } })[]
    referencedFieldIds?: string[]
}

type AirtableFieldOptions = {
    singleLineText: Record<string, never>
    email: Record<string, never>
    url: Record<string, never>
    multilineText: Record<string, never>
    number: NumberOption
    percent: PercentOption
    currency: CurrencyOption
    singleSelect: SelectOption
    multipleSelects: SelectOption
    singleCollaborator: Record<string, never>
    multipleCollaborators: Record<string, never>
    multipleRecordLinks: MultipleRecordLinksOption
    date: DateOption
    dateTime: DateTimeOption
    phoneNumber: Record<string, never>
    multipleAttachments: MultipleAttachmentsOption
    checkbox: CheckboxOption
    formula: FormulaOption
    createdTime: Record<string, never>
    rollup: RollupOption
    count: CountOption
    lookup: LookupOption
    multipleLookupValues: LookupOption
    autoNumber: Record<string, never>
    barcode: Record<string, never>
    rating: RatingOption
    richText: Record<string, never>
    duration: DurationOption
    lastModifiedTime: LastModifiedTimeOption
    button: Record<string, never>
    createdBy: Record<string, never>
    lastModifiedBy: Record<string, never>
    externalSyncSource: SelectOption
    aiText: AiTextOption
}

export interface AirtableBase extends AirtableBaseEntity {
    permissionLevel?: PermissionLevel
}

export type AirtableFieldSchema = AirtableBaseEntity & { description?: string } & (
        | {
              type: "singleLineText"
              options: AirtableFieldOptions["singleLineText"]
          }
        | { type: "email"; options: AirtableFieldOptions["email"] }
        | { type: "url"; options: AirtableFieldOptions["url"] }
        | { type: "multilineText"; options: AirtableFieldOptions["multilineText"] }
        | { type: "number"; options: AirtableFieldOptions["number"] }
        | { type: "percent"; options: AirtableFieldOptions["percent"] }
        | { type: "currency"; options: AirtableFieldOptions["currency"] }
        | { type: "singleSelect"; options: AirtableFieldOptions["singleSelect"] }
        | { type: "multipleSelects"; options: AirtableFieldOptions["multipleSelects"] }
        | { type: "singleCollaborator"; options: AirtableFieldOptions["singleCollaborator"] }
        | { type: "multipleCollaborators"; options: AirtableFieldOptions["multipleCollaborators"] }
        | { type: "multipleRecordLinks"; options: AirtableFieldOptions["multipleRecordLinks"] }
        | { type: "date"; options: AirtableFieldOptions["date"] }
        | { type: "dateTime"; options: AirtableFieldOptions["dateTime"] }
        | { type: "phoneNumber"; options: AirtableFieldOptions["phoneNumber"] }
        | { type: "multipleAttachments"; options: AirtableFieldOptions["multipleAttachments"] }
        | { type: "checkbox"; options: AirtableFieldOptions["checkbox"] }
        | { type: "formula"; options: AirtableFieldOptions["formula"] }
        | { type: "createdTime"; options: AirtableFieldOptions["createdTime"] }
        | { type: "rollup"; options: AirtableFieldOptions["rollup"] }
        | { type: "count"; options: AirtableFieldOptions["count"] }
        | { type: "lookup"; options: AirtableFieldOptions["lookup"] }
        | { type: "multipleLookupValues"; options: AirtableFieldOptions["multipleLookupValues"] }
        | { type: "autoNumber"; options: AirtableFieldOptions["autoNumber"] }
        | { type: "barcode"; options: AirtableFieldOptions["barcode"] }
        | { type: "rating"; options: AirtableFieldOptions["rating"] }
        | { type: "richText"; options: AirtableFieldOptions["richText"] }
        | { type: "duration"; options: AirtableFieldOptions["duration"] }
        | { type: "lastModifiedTime"; options: AirtableFieldOptions["lastModifiedTime"] }
        | { type: "button"; options: AirtableFieldOptions["button"] }
        | { type: "createdBy"; options: AirtableFieldOptions["createdBy"] }
        | { type: "lastModifiedBy"; options: AirtableFieldOptions["lastModifiedBy"] }
        | { type: "externalSyncSource"; options: AirtableFieldOptions["externalSyncSource"] }
        | { type: "aiText"; options: AirtableFieldOptions["aiText"] }
    )

interface View extends AirtableBaseEntity {
    type: string
}

export interface AirtableRecord {
    id: string
    createdTime: string
    fields: Record<FieldId, AirtableFieldValue>
}

export interface AirtableTableSchema extends AirtableBaseEntity {
    description?: string
    primaryFieldId: string
    fields: AirtableFieldSchema[]
    views: View[]
}

interface BaseSchemaResponse {
    tables: AirtableTableSchema[]
}

interface BasesResponse {
    bases: AirtableBase[]
    offset?: string
}

type QueryParams = Record<string, string | number | string[] | undefined>

interface RequestOptions {
    path: string
    method?: "get" | "post" | "delete" | "patch"
    query?: QueryParams
    body?: Record<string, unknown>
    signal?: AbortSignal
}

const API_URL = "https://api.airtable.com/v0"

// https://github.com/Airtable/airtable.js/blob/master/src/exponential_backoff_with_jitter.ts
const INITIAL_RETRY_DELAY = 5000 // 5 seconds, matching Airtable's config
const MAX_RETRY_DELAY = 600000 // 10 minutes, matching Airtable's config
const MAX_RETRY_ATTEMPTS = 10

// Exponential backoff with "Full Jitter" algorithm
const calculateBackoffDelay = (numAttempts: number): number => {
    const rawBackoffTime = INITIAL_RETRY_DELAY * Math.pow(2, numAttempts)
    const clippedBackoffTime = Math.min(MAX_RETRY_DELAY, rawBackoffTime)
    return Math.random() * clippedBackoffTime
}

const request = async ({ path, method, query, body, signal }: RequestOptions, numAttempts = 0) => {
    const tokens = await auth.getTokens()

    if (!tokens) {
        throw new Error("Invalid authentication.")
    }

    const url = new URL(`${API_URL}${path}`)

    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
                if (Array.isArray(value)) {
                    value.forEach(val => url.searchParams.append(key, decodeURIComponent(val)))
                } else {
                    url.searchParams.append(key, String(value))
                }
            }
        }
    }

    const res = await fetch(url.toString(), {
        method: method?.toUpperCase() ?? "GET",
        body: body ? JSON.stringify(body) : undefined,
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
        },
        signal,
    })

    const json = await res.json()

    if (res.status === 429 && numAttempts < MAX_RETRY_ATTEMPTS) {
        const delay = calculateBackoffDelay(numAttempts)
        await new Promise(resolve => setTimeout(resolve, delay))
        return request({ path, method, query, body }, numAttempts + 1)
    }

    if (!res.ok) {
        const errors = (json.errors as { error: string; message: string }[])?.map(
            ({ error, message }, index) => `${index + 1}. ${error}: ${message}`
        )
        throw new Error(`Failed to fetch Airtable API:\n\n${errors?.join("\n")}`)
    }

    return json
}

/**
 * Fetch the schema of a chosen base.
 */
export const fetchTables = async (baseId: string, signal?: AbortSignal): Promise<BaseSchemaResponse> => {
    return request({
        method: "get",
        path: `/meta/bases/${baseId}/tables`,
        signal,
    })
}

/**
 * Fetches the schema of a table.
 */
export const fetchTable = async (baseId: string, tableId: string) => {
    const bases = await fetchTables(baseId).catch(error => {
        if (error instanceof Error && error.name === "AbortError") {
            return null
        }

        throw error
    })

    if (!bases) {
        return null
    }

    const table = bases.tables.find(table => table.id === tableId)

    if (!table) {
        throw new Error(`Table with id ${tableId} not found`)
    }

    return table
}
/**
 * Fetches all bases. */
export const fetchBases = (offset?: string): Promise<BasesResponse> => {
    const query: QueryParams = {}
    if (offset) {
        query.offset = offset
    }

    return request({
        path: "/meta/bases",
        query,
    })
}

/**
 * Fetches all records from a table in a base.
 */
export const fetchRecords = async (baseId: string, tableId: string): Promise<AirtableRecord[]> => {
    const records: AirtableRecord[] = []
    let offset: string | undefined

    do {
        const data = await request({
            path: `/${baseId}/${tableId}`,
            method: "get",
            query: {
                returnFieldsByFieldId: "true",
                offset,
            },
        })

        records.push(...data.records)
        offset = data.offset
    } while (offset !== undefined)

    return records
}

export const fetchAllBases = async () => {
    let allBases: AirtableBase[] = []
    let currentOffset: string | undefined

    do {
        const response = await fetchBases(currentOffset)
        allBases = [...allBases, ...response.bases]
        currentOffset = response.offset
    } while (currentOffset)

    return allBases
}
