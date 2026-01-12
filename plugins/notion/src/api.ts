import { Client, collectPaginatedAPI, isFullBlock, isFullDatabase, isFullPage } from "@notionhq/client"
import type {
    BlockObjectResponse,
    GetDatabaseResponse,
    PageObjectResponse,
    RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"
import { framer, type ManagedCollectionField } from "framer-plugin"
import { blocksToHtml } from "./blocksToHtml"
import type { DatabaseIdMap } from "./data"
import { assert } from "./utils"

export const API_BASE_URL = "https://notion-plugin-api.framer-team.workers.dev"
export const PLUGIN_KEYS = {
    DATABASE_ID: "notionPluginDatabaseId",
    LAST_SYNCED: "notionPluginLastSynced",
    IGNORED_FIELD_IDS: "notionPluginIgnoredFieldIds",
    SLUG_FIELD_ID: "notionPluginSlugId",
    DATABASE_NAME: "notionDatabaseName",
    BEARER_TOKEN: "notionBearerToken",
} as const

// This is the most recent date when the page content formatted text importing was updated.
// If the last synced date for an item is before this date, the content is updated regardless of last edited time.
// The allows users to get the latest content formatting updates automatically.
const LAST_CONTENT_IMPORTING_UPDATE_DATE = new Date("2025-07-01T12:00:00.000Z")

export type FieldId = string

export type VirtualFieldType = ManagedCollectionField["type"] | "dateTime"

export interface FieldInfo {
    id: FieldId
    name: string
    originalName: string
    type: VirtualFieldType | null
    allowedTypes: VirtualFieldType[]
    notionProperty: NotionProperty | null
}

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

// Every page can have a cover image. We add it as a property so it displays
// in the list where you can configure properties to be synced with the CMS
export const pageCoverProperty: FieldInfo = {
    id: "page-cover",
    type: "image",
    name: "Cover",
    originalName: "Cover",
    allowedTypes: ["image"],
    notionProperty: null,
}

// The valid field types that can be used as a slug, in order of preference
const slugFieldTypes: NotionProperty["type"][] = ["title", "rich_text", "unique_id", "formula"]

export const supportedCMSTypeByNotionPropertyType = {
    checkbox: ["boolean"],
    date: ["dateTime", "date"],
    number: ["number"],
    title: ["string"],
    rich_text: ["formattedText", "string", "color"],
    created_time: ["dateTime", "date"],
    last_edited_time: ["dateTime", "date"],
    select: ["enum"],
    status: ["enum"],
    url: ["link"],
    email: ["formattedText", "string"],
    phone_number: ["string", "link"],
    files: ["file", "image", "array"],
    relation: ["multiCollectionReference", "collectionReference"],
    unique_id: ["string", "number"],
    formula: ["string", "number", "boolean", "date", "dateTime", "link", "color"],
} satisfies Partial<Record<NotionProperty["type"], readonly (ManagedCollectionField["type"] | "dateTime")[]>>

// Naive implementation to be authenticated, a token could be expired.
// For simplicity we just close the plugin and clear storage in that case.
export function isAuthenticated() {
    return localStorage.getItem(PLUGIN_KEYS.BEARER_TOKEN) !== null
}

let notionClientSingleton: Client | null = null

/**
 * Rate limiter to ensure we don't exceed Notion's API limits (~3 requests/second).
 * Uses a simple queue-based approach with minimum time between requests.
 */
const REQUEST_INTERVAL_MS = 350 // ~3 requests per second with small buffer
let lastRequestTime = 0
let requestQueue: Promise<void> = Promise.resolve()

/**
 * Ensures requests are spaced out to respect Notion's rate limits.
 * Returns a promise that resolves when it's safe to make the next request.
 */
function waitForRateLimit(): Promise<void> {
    requestQueue = requestQueue.then(async () => {
        const now = Date.now()
        const timeSinceLastRequest = now - lastRequestTime
        const waitTime = Math.max(0, REQUEST_INTERVAL_MS - timeSinceLastRequest)

        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
        }

        lastRequestTime = Date.now()
    })

    return requestQueue
}

/**
 * Global rate limit coordinator for handling 429 responses.
 * When any request hits a 429, all requests wait for the same backoff period.
 * After waiting, we reset lastRequestTime so requests can resume immediately
 * through the normal rate limiter.
 */
let rateLimitPausePromise: Promise<void> | null = null

async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 10): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Wait if we're globally rate limited (429 response)
        if (rateLimitPausePromise) {
            await rateLimitPausePromise
        }

        // Proactively wait to respect rate limits
        await waitForRateLimit()

        const response = await fetch(url, options)

        if (response.status === 429) {
            // Only set up global pause if not already paused
            if (!rateLimitPausePromise) {
                const retryAfter = parseInt(response.headers.get("Retry-After") ?? "1", 10)
                // Use server's Retry-After, with exponential backoff as minimum fallback
                const backoffTime = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt))
                console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries + 1}), waiting ${backoffTime}ms...`)

                rateLimitPausePromise = new Promise(resolve => {
                    setTimeout(() => {
                        rateLimitPausePromise = null
                        // Reset the rate limiter timing so queued requests can proceed
                        lastRequestTime = 0
                        resolve()
                    }, backoffTime)
                })
            }

            // All requests wait on the same promise
            await rateLimitPausePromise
            continue
        }

        return response
    }

    throw new Error("Max retries exceeded")
}

export function getNotionClient(): Client {
    if (notionClientSingleton) {
        return notionClientSingleton
    }

    const token = localStorage.getItem(PLUGIN_KEYS.BEARER_TOKEN)
    if (!token) throw new Error("Notion API token is missing")

    notionClientSingleton = new Client({
        fetch: async (url, fetchInit) => {
            const urlObj = new URL(url)
            const fullUrl = `${API_BASE_URL}/notion${urlObj.pathname}${urlObj.search}`

            const resp = await fetchWithRetry(fullUrl, fetchInit)

            // If status is unauthorized, clear the token
            // And we close the plugin (for now)
            // TODO: Improve this flow in the plugin.
            if (resp.status === 401) {
                localStorage.removeItem(PLUGIN_KEYS.BEARER_TOKEN)
                framer.closePlugin("Notion Authorization Failed. Re-open the plugin to re-authorize.", {
                    variant: "error",
                })
            }

            return resp
        },
        auth: token,
    })

    return notionClientSingleton
}

export async function getNotionDatabases() {
    const notion = getNotionClient()

    const results = await collectPaginatedAPI(notion.search, {
        filter: {
            property: "object",
            value: "database",
        },
    })

    return results.filter(isFullDatabase)
}

export function assertFieldTypeMatchesPropertyType(
    propertyType: NotionProperty["type"],
    fieldType: VirtualFieldType | ManagedCollectionField["type"]
): void {
    if (!isSupportedPropertyType(propertyType)) {
        throw new Error(`Property type '${propertyType}' is not supported.`)
    }

    const allowedFieldTypes = supportedCMSTypeByNotionPropertyType[propertyType]

    // For dateTime, treat it as "date" for validation purposes
    const typeToCheck = fieldType === "dateTime" ? "date" : fieldType

    if (!allowedFieldTypes.includes(typeToCheck as never)) {
        throw new Error(`Field type '${fieldType}' is not valid for property type '${propertyType}'.`)
    }
}

export async function getDatabase(databaseId: string) {
    const notion = getNotionClient()
    const database = await notion.databases.retrieve({ database_id: databaseId })

    if (!isFullDatabase(database)) {
        throw new Error(`Database ${databaseId} is not a full database`)
    }

    return database
}

export function richTextToPlainText(richText: RichTextItemResponse[] | undefined) {
    return Array.isArray(richText) ? richText.map(value => value.plain_text).join("") : ""
}

function isSupportedPropertyType(type: string): type is keyof typeof supportedCMSTypeByNotionPropertyType {
    return type in supportedCMSTypeByNotionPropertyType
}

export function getDatabaseFieldsInfo(database: GetDatabaseResponse, databaseIdMap: DatabaseIdMap) {
    const result: FieldInfo[] = []

    // These properties are always there but not included in `"database.properties"
    result.push(pageCoverProperty, pageContentProperty)

    const supported: FieldInfo[] = []
    const unsupported: FieldInfo[] = []
    const missingCollection: FieldInfo[] = []

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        const allowedTypes = isSupportedPropertyType(property.type)
            ? supportedCMSTypeByNotionPropertyType[property.type]
            : []
        const fieldInfo: FieldInfo = {
            id: property.id,
            name: property.name,
            originalName: property.name,
            type: allowedTypes[0] ?? null,
            allowedTypes,
            notionProperty: property,
        }

        if (isMissingCollection(fieldInfo, databaseIdMap)) {
            missingCollection.push(fieldInfo)
            continue
        }

        const isSupported = Array.isArray(allowedTypes) && allowedTypes.length > 0
        if (isSupported) {
            supported.push(fieldInfo)
        } else {
            unsupported.push(fieldInfo)
        }
    }

    // Maintain original order except unsupported fields go to the end
    const allFields = result.concat(supported, missingCollection, unsupported)

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

        if (slugFieldTypes.includes(property.type)) {
            options.push(property)
        }
    }

    function getOrderIndex(type: NotionProperty["type"]): number {
        const index = slugFieldTypes.indexOf(type)
        return index === -1 ? slugFieldTypes.length : index
    }

    options.sort((a, b) => getOrderIndex(a.type) - getOrderIndex(b.type))

    return options.map(property => property.id)
}

export function getSlugValue(property: PageObjectResponse["properties"][string]): string | null {
    switch (property.type) {
        case "title":
            return richTextToPlainText(property.title)
        case "rich_text":
            return richTextToPlainText(property.rich_text)
        case "unique_id":
            return property.unique_id.prefix
                ? `${property.unique_id.prefix}-${String(property.unique_id.number)}`
                : String(property.unique_id.number)
        case "formula":
            switch (property.formula.type) {
                case "string": {
                    return property.formula.string ?? null
                }
                case "number": {
                    const number = property.formula.number
                    return Number.isFinite(number) ? String(number) : null
                }
                case "boolean": {
                    const boolean = property.formula.boolean
                    return typeof boolean === "boolean" ? String(boolean) : null
                }
                case "date": {
                    return property.formula.date?.start ?? null
                }
                default:
                    return null
            }
        default:
            return null
    }
}

async function getBlockChildrenIterator(blockId: string) {
    const notion = getNotionClient()
    const blocksIterator = iteratePaginatedAPI(notion.blocks.children.list, {
        block_id: blockId,
    })
    const blocks: BlockObjectResponse[] = []
    for await (const block of blocksIterator) {
        if (!isFullBlock(block)) continue
        blocks.push(block)
    }
    return blocks
}

export async function getPageBlocksAsRichText(pageId: string) {
    const notion = getNotionClient()

    const blocksIterator = iteratePaginatedAPI(notion.blocks.children.list, {
        block_id: pageId,
    })

    const blocks: BlockObjectResponse[] = []
    for await (const block of blocksIterator) {
        if (!isFullBlock(block)) continue
        blocks.push(block)

        if (block.type === "table") {
            const tableRows = await getBlockChildrenIterator(block.id)
            blocks.push(...tableRows)
        }
    }

    assert(blocks.every(isFullBlock), "Response is not a full block")

    return blocksToHtml(blocks)
}

export async function getDatabaseItems(
    database: GetDatabaseResponse,
    onProgress?: (progress: { current: number; total: number }) => void
): Promise<PageObjectResponse[]> {
    const notion = getNotionClient()

    const data: PageObjectResponse[] = []
    let itemCount = 0

    const databaseIterator = iteratePaginatedAPI(notion.databases.query, {
        database_id: database.id,
    })

    for await (const item of databaseIterator) {
        data.push(item as PageObjectResponse)
        itemCount++
        onProgress?.({ current: 0, total: itemCount })
    }

    const pages = data.filter(isFullPage)

    return pages
}

export function isUnchangedSinceLastSync(lastEditedTime: string, lastSyncedTime: string | null): boolean {
    if (!lastSyncedTime) return false

    const lastEdited = new Date(lastEditedTime)
    const lastSynced = new Date(lastSyncedTime)

    // If last sync was before the most recent content importing update, we need to update
    if (lastSynced < LAST_CONTENT_IMPORTING_UPDATE_DATE) return false

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

export function isMissingCollection(fieldInfo: FieldInfo, databaseIdMap: DatabaseIdMap): boolean {
    return Boolean(
        fieldInfo.notionProperty?.type === "relation" &&
            fieldInfo.notionProperty.relation.database_id &&
            !databaseIdMap.has(fieldInfo.notionProperty.relation.database_id)
    )
}
