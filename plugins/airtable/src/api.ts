import { useQuery, useMutation } from "@tanstack/react-query"
import { SynchronizeResult, SyncMutationOptions, syncTable } from "./airtable"
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

interface AirtableBase extends AirtableBaseEntity {
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

interface FetchRecordsParams {
    baseId: string
    tableId: string
}

type QueryParams = Record<string, string | number | string[]> | URLSearchParams

interface RequestOptions {
    path: string
    method?: "get" | "post" | "delete" | "patch"
    query?: QueryParams
    body?: Record<string, unknown>
}

const API_URL = "https://api.airtable.com/v0"
const MAX_CMS_ITEMS = 10000

const request = async ({ path, method, query, body }: RequestOptions) => {
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
    })

    const json = await res.json()

    if (!res.ok) {
        const errorMessage = json.error.message
        throw new Error("Failed to fetch Airtable API: " + errorMessage)
    }

    return json
}

/**
 * Fetch the schema of a chosen base.
 */
export const fetchBaseSchema = async (baseId: string): Promise<BaseSchemaResponse> => {
    return request({
        method: "get",
        path: `/meta/bases/${baseId}/tables`,
    })
}

/**
 * Fetches all bases.
 */
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
export const fetchRecords = async (args: FetchRecordsParams): Promise<AirtableRecord[]> => {
    const { baseId, tableId } = args
    const records: AirtableRecord[] = []
    let offset = ""

    do {
        const data = await request({
            path: `/${baseId}/${tableId}`,
            method: "get",
            query: {
                returnFieldsByFieldId: "true",
                maxRecords: MAX_CMS_ITEMS,
                offset,
            },
        })

        records.push(...data.records)
        offset = data.offset
    } while (offset && records.length < MAX_CMS_ITEMS)

    if (offset) {
        const lastRecord = records[records.length - 1]
        console.warn(
            `There are more than ${MAX_CMS_ITEMS} records in this table. Some records may not be fetched. The last item that will be fetched is: ${lastRecord.id}`
        )
    }

    return records
}

export const useBasesQuery = () => {
    return useQuery({
        queryKey: ["bases"],
        queryFn: async () => {
            let allBases: AirtableBase[] = []
            let currentOffset: string | undefined

            do {
                const response = await fetchBases(currentOffset)
                allBases = [...allBases, ...response.bases]
                currentOffset = response.offset
            } while (currentOffset)

            return allBases
        },
    })
}

export const useBaseSchemaQuery = (baseId: string) => {
    return useQuery({
        queryKey: ["baseSchema", baseId],
        queryFn: () => fetchBaseSchema(baseId),
        enabled: !!baseId,
    })
}

export const useSyncTableMutation = ({
    onSuccess,
    onError,
}: {
    onSuccess?: (result: SynchronizeResult) => void
    onError?: (e: Error) => void
}) => {
    return useMutation({
        mutationFn: (args: SyncMutationOptions) => syncTable(args),
        onSuccess,
        onError,
    })
}
