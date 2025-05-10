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
import { blocksToHtml, richTextToHTML } from "./blocksToHTML"
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

// Maximum number of concurrent requests to Notion API
// This is to prevent rate limiting.
const CONCURRENCY_LIMIT = 5

export type NotionProperty = GetDatabaseResponse["properties"][string]

// Every page has content which can be fetched as blocks. We add it as a
// property so it displays in the list where you can configure properties to be
// synced with the CMS
const pageContentId = "page-content"
export const pageContentProperty: SupportedNotionProperty = {
    type: "rich_text",
    id: pageContentId,
    name: "Content",
    description: "Page Content",
    rich_text: {},
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

function assertFieldTypeMatchesPropertyType<T extends SupportedPropertyType>(
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

export function getNotionProperties(database: GetDatabaseResponse) {
    const result: NotionProperty[] = []

    // This property is always there but not included in `"database.properties"
    result.push(pageContentProperty)

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        result.push(property)
    }

    return result
}

/**
 * Given a Notion Database returns a list of possible fields that can be used as
 * a slug. And a suggested field id to use as a slug.
 */
export function getPossibleSlugFields(database: GetDatabaseResponse) {
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

    return options
}

export function getPropertyValue(
    property: PageObjectResponse["properties"][string],
    { supportsHtml }: { supportsHtml: boolean }
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
            if (!property.select) return null

            return property.select.id
        }
        case "title":
            if (supportsHtml) {
                return richTextToHTML(property.title)
            }

            return richTextToPlainText(property.title)
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
        }
    }
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

    return blocksToHtml(blocks)
}
