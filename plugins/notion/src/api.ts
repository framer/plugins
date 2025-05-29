import {
    APIErrorCode,
    Client,
    collectPaginatedAPI,
    isFullBlock,
    isFullDatabase,
    isFullPage,
    isNotionClientError,
} from "@notionhq/client"
import type {
    BlockObjectResponse,
    GetDatabaseResponse,
    PageObjectResponse,
    RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
    framer,
    type CollectionItemData,
    type ManagedCollection,
    type ManagedCollectionField,
    type FieldData,
} from "framer-plugin"
import pLimit from "p-limit"
import { blocksToHTML, richTextToHTML } from "./blocksToHTML"
import { assert, assertNever, formatDate, isDefined, isString, slugify } from "./utils"

export const API_BASE_URL = "https://notion-plugin-api.framer-team.workers.dev"
export const PLUGIN_KEYS = {
    DATABASE_ID: "notionPluginDatabaseId",
    LAST_SYNCED: "notionPluginLastSynced",
    IGNORED_FIELD_IDS: "notionPluginIgnoredFieldIds",
    SLUG_FIELD_ID: "notionPluginSlugId",
    DATABASE_NAME: "notionDatabaseName",
    BEARER_TOKEN: "notionBearerToken",
} as const

export type FieldId = string

export interface FieldInfo {
    id: FieldId
    name: string
    originalName: string
    type: ManagedCollectionField["type"] | null
    allowedTypes: ManagedCollectionField["type"][]
    notionProperty: NotionProperty | null
}

// Maximum number of concurrent requests to Notion API
// This is to prevent rate limiting.
const CONCURRENCY_LIMIT = 5

export type NotionProperty = GetDatabaseResponse["properties"][string]

// Every page has content which can be fetched as blocks. We add it as a
// property so it displays in the list where you can configure properties to be
// synced with the CMS
export const pageContentProperty: FieldInfo = {
    id: "page-content",
    type: "formattedText",
    name: "Content",
    originalName: "Content",
    allowedTypes: ["formattedText"],
    notionProperty: null,
}

// The order in which we display slug fields
const preferedSlugFieldOrder: NotionProperty["type"][] = ["title", "rich_text"]

export const supportedNotionPropertyTypes = [
    "email",
    "rich_text",
    "date",
    "last_edited_time",
    "select",
    "number",
    "checkbox",
    "created_time",
    "title",
    "status",
    "url",
    "files",
    "relation",
] satisfies ReadonlyArray<NotionProperty["type"]>

type SupportedPropertyType = (typeof supportedNotionPropertyTypes)[number]
type SupportedNotionProperty = Extract<NotionProperty, { type: SupportedPropertyType }>

// Naive implementation to be authenticated, a token could be expired.
// For simplicity we just close the plugin and clear storage in that case.
export function isAuthenticated() {
    return localStorage.getItem(PLUGIN_KEYS.BEARER_TOKEN) !== null
}

let notion: Client | null = null
if (isAuthenticated()) {
    initNotionClient()
}

export function initNotionClient() {
    const token = localStorage.getItem(PLUGIN_KEYS.BEARER_TOKEN)
    if (!token) throw new Error("Notion API token is missing")

    notion = new Client({
        fetch: async (url, fetchInit) => {
            const urlObj = new URL(url)

            try {
                const resp = await fetch(`${API_BASE_URL}/notion${urlObj.pathname}${urlObj.search}`, fetchInit)

                // If status is unauthorized, clear the token
                // And we close the plugin (for now)
                // TODO: Improve this flow in the plugin.
                if (resp.status === 401) {
                    localStorage.removeItem(PLUGIN_KEYS.BEARER_TOKEN)
                    await framer.closePlugin("Notion Authorization Failed. Re-open the plugin to re-authorize.", {
                        variant: "error",
                    })
                    return resp
                }

                return resp
            } catch (error) {
                console.log("Notion API error", error)
                throw error
            }
        },
        auth: token,
    })
}

export function isSupportedNotionProperty(property: NotionProperty): property is SupportedNotionProperty {
    return supportedNotionPropertyTypes.includes(property.type as SupportedPropertyType)
}

export async function getNotionDatabases() {
    if (!notion) {
        initNotionClient()
    }

    const results = await collectPaginatedAPI(notion!.search, {
        filter: {
            property: "object",
            value: "database",
        },
    })

    return results.filter(isFullDatabase)
}

export const supportedCMSTypeByNotionPropertyType = {
    checkbox: ["boolean"],
    date: ["date"],
    number: ["number"],
    title: ["string"],
    rich_text: ["formattedText", "string"],
    created_time: ["date"],
    last_edited_time: ["date"],
    select: ["enum"],
    status: ["enum"],
    url: ["link"],
    email: ["formattedText", "string"],
    files: ["file", "image"],
    relation: ["multiCollectionReference"],
} satisfies Record<SupportedPropertyType, ReadonlyArray<ManagedCollectionField["type"]>>

export function assertFieldTypeMatchesPropertyType<T extends SupportedPropertyType>(
    propertyType: T,
    fieldType: ManagedCollectionField["type"]
): asserts fieldType is (typeof supportedCMSTypeByNotionPropertyType)[T][number] {
    const allowedFieldTypes = supportedCMSTypeByNotionPropertyType[propertyType]

    if (!allowedFieldTypes.includes(fieldType as never)) {
        throw new Error(`Field type '${fieldType}' is not valid for property type '${propertyType}'.`)
    }
}

export async function getDatabase(databaseId: string) {
    if (!notion) {
        initNotionClient()
    }

    assert(notion, "Notion client is not initialized")
    const database = await notion.databases.retrieve({ database_id: databaseId })

    return database
}

export function richTextToPlainText(richText: RichTextItemResponse[] | undefined) {
    return Array.isArray(richText) ? richText.map(value => value.plain_text).join("") : ""
}

export function getDatabaseFieldsInfo(database: GetDatabaseResponse) {
    const result: FieldInfo[] = []

    // This property is always there but not included in `"database.properties"
    result.push(pageContentProperty)

    const supported: FieldInfo[] = []
    const unsupported: FieldInfo[] = []

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        const allowedTypes = supportedCMSTypeByNotionPropertyType[property.type] ?? []
        const fieldInfo: FieldInfo = {
            id: property.id,
            name: property.name,
            originalName: property.name,
            type: allowedTypes[0] ?? null,
            allowedTypes,
            notionProperty: property,
        }

        const isUnsupported = !Array.isArray(allowedTypes) || allowedTypes.length === 0
        if (isUnsupported) {
            unsupported.push(fieldInfo)
        } else {
            supported.push(fieldInfo)
        }
    }

    // Maintain original order except unsupported fields go to the end
    const allFields = result.concat(supported, unsupported)

    // Sort title field to beginning of the list
    return allFields.sort((a, b) => {
        if (a.notionProperty?.type === "title") return -1
        if (b.notionProperty?.type === "title") return 1
        return 0
    })
}

/**
 * Given a Notion Database returns a list of possible fields that can be used as
 * a slug. And a suggested field id to use as a slug.
 */
export function getPossibleSlugFieldIds(database: GetDatabaseResponse) {
    const options: NotionProperty[] = []

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        switch (property.type) {
            case "title":
            case "rich_text":
                options.push(property)
                break
        }
    }

    function getOrderIndex(type: NotionProperty["type"]): number {
        const index = preferedSlugFieldOrder.indexOf(type)
        return index === -1 ? preferedSlugFieldOrder.length : index
    }

    options.sort((a, b) => getOrderIndex(a.type) - getOrderIndex(b.type))

    return options.map(property => property.id)
}

async function getPageBlocksAsRichText(pageId: string) {
    assert(notion, "Notion client is not initialized")

    const blocksIterator = iteratePaginatedAPI(notion.blocks.children.list, {
        block_id: pageId,
    })

    const blocks: BlockObjectResponse[] = []
    for await (const block of blocksIterator) {
        if (!isFullBlock(block)) continue
        blocks.push(block)
    }

    assert(blocks.every(isFullBlock), "Response is not a full block")

    return blocksToHTML(blocks)
}

export type DatabaseIdMap = Map<string, string>
export async function getDatabaseIdMap(): Promise<DatabaseIdMap> {
    const databaseIdMap: DatabaseIdMap = new Map()

    for (const collection of await framer.getCollections()) {
        const collectionDatabaseId = await collection.getPluginData(PLUGIN_KEYS.DATABASE_ID)
        if (!collectionDatabaseId) continue

        databaseIdMap.set(collectionDatabaseId, collection.id)
    }

    return databaseIdMap
}

export function getPropertyValue(
    property: PageObjectResponse["properties"][string],
    { supportsHtml, field }: { supportsHtml: boolean; field?: ManagedCollectionField }
): unknown | undefined {
    switch (property.type) {
        case "checkbox": {
            return property.checkbox
        }
        case "last_edited_time": {
            return property.last_edited_time
        }
        case "created_time": {
            return property.created_time
        }
        case "rich_text": {
            if (supportsHtml) {
                return richTextToHTML(property.rich_text)
            }

            return richTextToPlainText(property.rich_text)
        }
        case "select": {
            if (!property.select) {
                return field?.type === "enum" ? (field?.cases?.[0]?.id ?? null) : null
            }

            return property.select.id
        }
        case "status": {
            if (!property.status) {
                return field?.type === "enum" ? (field?.cases?.[0]?.id ?? null) : null
            }

            return property.status.id
        }
        case "title": {
            if (supportsHtml) {
                return richTextToHTML(property.title)
            }

            return richTextToPlainText(property.title)
        }
        case "number": {
            return property.number
        }
        case "url": {
            return property.url
        }
        case "unique_id": {
            return property.unique_id.number
        }
        case "date": {
            return property.date?.start
        }
        case "relation": {
            return property.relation.map(({ id }) => id)
        }
        case "files": {
            const firstFile = property.files[0]
            if (!firstFile) return null

            if (firstFile.type === "external") {
                return firstFile.external.url
            }

            if (firstFile.type === "file") {
                return firstFile.file.url
            }

            return null
        }
        case "email": {
            return property.email ?? ""
        }
    }
}

async function processItem(
    item: PageObjectResponse,
    fieldsById: FieldsById,
    slugFieldId: string,
    status: SyncStatus
): Promise<CollectionItemData | null> {
    let slugValue: null | string = null

    const fieldData: FieldData = {}

    assert(isFullPage(item))

    for (const key in item.properties) {
        const property = item.properties[key]
        assert(property)

        if (property.id === slugFieldId) {
            const resolvedSlug = getPropertyValue(property, { supportsHtml: false })
            if (!resolvedSlug || typeof resolvedSlug !== "string") {
                continue
            }

            slugValue = slugify(resolvedSlug)
        }

        const field = fieldsById.get(property.id)

        // We can continue if the property was not included in the field mapping
        if (!field) {
            continue
        }

        const fieldValue = getPropertyValue(property, { supportsHtml: field.type === "formattedText", field })
        if (!fieldValue) {
            status.warnings.push({
                url: item.url,
                fieldId: field.id,
                message: `Value is missing for field ${field.name}`,
            })
        }

        fieldData[field.id] = { type: field.type, value: fieldValue }
    }

    if (fieldsById.has(pageContentProperty.id) && item.id) {
        const contentHTML = await getPageBlocksAsRichText(item.id)
        fieldData[pageContentProperty.id] = { type: "formattedText", value: contentHTML }
    }

    if (!slugValue) {
        status.warnings.push({
            url: item.url,
            message: "Slug or Title is missing. Skipping item.",
        })
        return null
    }

    return {
        id: item.id,
        fieldData,
        slug: slugValue,
    }
}

type FieldsById = Map<FieldId, ManagedCollectionField>

export interface ItemResult {
    url: string
    fieldId?: string
    message: string
}

export interface SynchronizeProgress {
    totalCount: number
    completedCount: number
    completedPercent: number
}

interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}
type OnProgressHandler = (progress: SynchronizeProgress) => void

async function processAllItems(
    data: PageObjectResponse[],
    fieldsByKey: FieldsById,
    slugFieldId: string,
    lastSyncedDate: string | null,
    onProgress: OnProgressHandler
) {
    const seenItemIds = new Set<string>()
    const limit = pLimit(CONCURRENCY_LIMIT)
    const status: SyncStatus = {
        errors: [],
        info: [],
        warnings: [],
    }

    const totalCount = data.length
    let completedCount = 0

    onProgress({
        totalCount,
        completedCount,
        completedPercent: 0,
    })

    const promises = data.map(item =>
        limit(async () => {
            seenItemIds.add(item.id)

            if (isUnchangedSinceLastSync(item.last_edited_time, lastSyncedDate)) {
                status.info.push({
                    message: `Skipping. last updated: ${formatDate(item.last_edited_time)}, last synced: ${formatDate(lastSyncedDate!)}`,
                    url: item.url,
                })
                return null
            }

            const result = await processItem(item, fieldsByKey, slugFieldId, status)

            completedCount++
            onProgress({
                completedCount,
                totalCount,
                completedPercent: Math.round((completedCount / totalCount) * 100),
            })

            return result
        })
    )
    const results = await Promise.all(promises)

    const items = results.filter(isDefined)

    return {
        items,
        status,
        seenItemIds,
    }
}

export interface SynchronizeMutationOptions {
    fields: ManagedCollectionField[]
    ignoredFieldIds: string[]
    lastSyncedTime: string | null
    slugFieldId: string
    onProgress: OnProgressHandler
}

export interface SynchronizeResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

export async function getDatabaseItems(database: GetDatabaseResponse): Promise<PageObjectResponse[]> {
    assert(notion)

    const data = await collectPaginatedAPI(notion.databases.query, {
        database_id: database.id,
    })
    assert(data.every(isFullPage), "Response is not a full page")

    return data
}

export async function synchronizeDatabase(
    database: GetDatabaseResponse,
    { fields, ignoredFieldIds, lastSyncedTime, slugFieldId, onProgress }: SynchronizeMutationOptions
): Promise<SynchronizeResult> {
    assert(isFullDatabase(database))
    assert(notion)

    const collection = await framer.getActiveManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map<string, ManagedCollectionField>()
    for (const field of fields) {
        fieldsById.set(field.id, field)
    }

    const data = await collectPaginatedAPI(notion.databases.query, {
        database_id: database.id,
    })
    assert(data.every(isFullPage), "Response is not a full page")

    const { collectionItems, status, seenItemIds } = await processAllItems(
        data,
        fieldsById,
        slugFieldId,
        lastSyncedTime,
        onProgress
    )

    const itemIdsToDelete = new Set(await collection.getItemIds())
    for (const itemId of seenItemIds) {
        itemIdsToDelete.delete(itemId)
    }

    if (import.meta.env.DEV) {
        console.table(collectionItems)
    }

    await collection.addItems(collectionItems)
    await collection.removeItems(Array.from(itemIdsToDelete))

    await Promise.all([
        collection.setPluginData(PLUGIN_KEYS.IGNORED_FIELD_IDS, JSON.stringify(ignoredFieldIds)),
        collection.setPluginData(PLUGIN_KEYS.DATABASE_ID, database.id),
        collection.setPluginData(PLUGIN_KEYS.LAST_SYNCED, new Date().toISOString()),
        collection.setPluginData(PLUGIN_KEYS.SLUG_FIELD_ID, slugFieldId),
        collection.setPluginData(PLUGIN_KEYS.DATABASE_NAME, richTextToPlainText(database.title)),
    ])

    return {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }
}

export function isUnchangedSinceLastSync(lastEditedTime: string, lastSyncedTime: string | null): boolean {
    if (!lastSyncedTime) return false

    const lastEdited = new Date(lastEditedTime)
    const lastSynced = new Date(lastSyncedTime)
    // Last edited time is rounded to the nearest minute.
    // So we should round lastSyncedTime to the nearest minute as well.
    lastSynced.setSeconds(0, 0)

    return lastSynced > lastEdited
}

interface PaginatedArgs {
    start_cursor?: string
}

interface PaginatedList<T> {
    object: "list"
    results: T[]
    next_cursor: string | null
    has_more: boolean
}

/**
 * Copied from:
 * https://github.com/makenotion/notion-sdk-js/blob/7950edc034d3007b0612b80d3f424baef89746d9/src/helpers.ts#L47
 * Notion has a bug where pagination returns the same page cursor when fetching
 * another page in some rare cases. This results in the same pages being fetched
 * over and over, resulting in infinite loop. This function is modified to keep
 * track of which page cursors we've seen and bail out early in case the same
 * cursor is seen twice
 */
export async function* iteratePaginatedAPI<Args extends PaginatedArgs, Item>(
    listFn: (args: Args) => Promise<PaginatedList<Item>>,
    firstPageArgs: Args
): AsyncIterableIterator<Item> {
    const seenCursors = new Set<string>()
    let nextCursor: string | null | undefined = firstPageArgs.start_cursor

    do {
        const response: PaginatedList<Item> = await listFn({
            ...firstPageArgs,
            start_cursor: nextCursor,
        })
        yield* response.results

        if (!response.next_cursor) return

        if (seenCursors.has(response.next_cursor)) {
            console.warn(
                "Encountered an infinite loop while paginating. This is a bug on the Notion side. Proceeding with partial content."
            )
            return
        }

        seenCursors.add(response.next_cursor)
        nextCursor = response.next_cursor
    } while (nextCursor)
}
