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
