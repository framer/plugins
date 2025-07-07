import { Client, collectPaginatedAPI, isFullBlock, isFullDatabase, isFullPage } from "@notionhq/client"
import type {
    BlockObjectResponse,
    GetDatabaseResponse,
    PageObjectResponse,
    RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"
import {
    type FieldDataEntryInput,
    framer,
    type ManagedCollectionField,
    type ManagedCollectionFieldInput,
} from "framer-plugin"
import { blocksToHTML, richTextToHTML } from "./blocksToHTML"
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

export interface FieldInfo {
    id: FieldId
    name: string
    originalName: string
    type: ManagedCollectionField["type"] | null
    allowedTypes: ManagedCollectionField["type"][]
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

// The valid field types that can be used as a slug, in order of preference
const slugFieldTypes: NotionProperty["type"][] = ["title", "rich_text"]

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
} satisfies Partial<Record<NotionProperty["type"], ReadonlyArray<ManagedCollectionField["type"]>>>

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

export function assertFieldTypeMatchesPropertyType(
    propertyType: NotionProperty["type"],
    fieldType: ManagedCollectionField["type"]
): asserts fieldType is ManagedCollectionField["type"] {
    if (!isSupportedPropertyType(propertyType)) {
        throw new Error(`Property type '${propertyType}' is not supported.`)
    }

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

    // This property is always there but not included in `"database.properties"
    result.push(pageContentProperty)

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

        const isUnsupported = !Array.isArray(allowedTypes) || allowedTypes.length === 0
        if (isUnsupported) {
            unsupported.push(fieldInfo)
        } else {
            supported.push(fieldInfo)
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
        default:
            return null
    }
}

async function getBlockChildrenIterator(blockId: string) {
    assert(notion, "Notion client is not initialized")
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
    assert(notion, "Notion client is not initialized")

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

    return blocksToHTML(blocks)
}

export function getFieldDataEntryForProperty(
    property: PageObjectResponse["properties"][string],
    field: ManagedCollectionFieldInput
): FieldDataEntryInput | null {
    switch (property.type) {
        case "checkbox": {
            return { type: "boolean", value: property.checkbox ?? false }
        }
        case "last_edited_time": {
            return { type: "date", value: property.last_edited_time }
        }
        case "created_time": {
            return { type: "date", value: property.created_time }
        }
        case "rich_text": {
            if (field.type === "formattedText") {
                return { type: "formattedText", value: richTextToHTML(property.rich_text) }
            }

            return { type: "string", value: richTextToPlainText(property.rich_text) }
        }
        case "select": {
            if (field.type !== "enum") return null

            if (!property.select) {
                const firstCase = field.cases?.[0]?.id
                return firstCase ? { type: "enum", value: firstCase } : null
            }

            return { type: "enum", value: property.select.id }
        }
        case "status": {
            if (field.type !== "enum") return null

            if (!property.status) {
                const firstCase = field.cases?.[0]?.id
                return firstCase ? { type: "enum", value: firstCase } : null
            }

            return { type: "enum", value: property.status.id }
        }
        case "title": {
            if (field.type === "formattedText") {
                return { type: "formattedText", value: richTextToHTML(property.title) }
            }

            return { type: "string", value: richTextToPlainText(property.title) }
        }
        case "number": {
            return { type: "number", value: property.number ?? 0 }
        }
        case "url": {
            return { type: "link", value: property.url ?? "" }
        }
        case "unique_id": {
            return { type: "string", value: property.unique_id.number?.toString() ?? "" }
        }
        case "date": {
            return { type: "date", value: property.date?.start ?? null }
        }
        case "relation": {
            return { type: "multiCollectionReference", value: property.relation.map(({ id }) => id) }
        }
        case "files": {
            if (field.type !== "file" && field.type !== "image") return null

            const firstFile = property.files[0]

            switch (firstFile?.type) {
                case "external":
                    return { type: field.type, value: firstFile.external.url }
                case "file":
                    return { type: field.type, value: firstFile.file.url }
                default:
                    return { type: field.type, value: null }
            }
        }
        case "email": {
            if (field.type !== "formattedText" && field.type !== "string") return null

            return { type: field.type, value: property.email ?? "" }
        }
    }

    return null
}

export async function getDatabaseItems(database: GetDatabaseResponse): Promise<PageObjectResponse[]> {
    assert(notion)

    const data = await collectPaginatedAPI(notion.databases.query, {
        database_id: database.id,
    })
    assert(data.every(isFullPage), "Response is not a full page")

    return data
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
            fieldInfo.notionProperty.relation?.database_id &&
            !databaseIdMap.has(fieldInfo.notionProperty.relation.database_id)
    )
}
