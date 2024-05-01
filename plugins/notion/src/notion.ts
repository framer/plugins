import { Client, collectPaginatedAPI, isFullBlock, isFullDatabase, isFullPage } from "@notionhq/client"
import pLimit from "p-limit"
import { GetDatabaseResponse, PageObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints"
import { assert, formatDate, isDefined, isString, slugify } from "./utils"
import { Collection, CollectionField, CollectionItem, framer } from "framer-plugin"
import { useMutation, useQuery } from "@tanstack/react-query"
import { blocksToHtml, richTextToHTML } from "./blocksToHTML"

export type FieldId = string

const apiBaseUrl = "https://notion-plugin-api.niekkruse70.workers.dev"
const oauthRedirectUrl = encodeURIComponent(`${apiBaseUrl}/auth/authorize/callback`)

const getOauthURL = (writeKey: string) =>
    `https://api.notion.com/v1/oauth/authorize?client_id=3504c5a7-9f75-4f87-aa1b-b735f8480432&response_type=code&owner=user&redirect_uri=${oauthRedirectUrl}&state=${writeKey}`

// Storage for the notion API key.
const notionBearerStorageKey = "notionBearerToken"

// NOTE: Changing these keys can break behavior of existing plugins.
const pluginDatabaseIdKey = "notionPluginDatabaseId"
const pluginLastSyncedKey = "notionPluginLastSynced"
const ignoredFieldIdsKey = "notionPluginIgnoredFieldIds"

// A page in database consists of blocks.
// We allow configuration to include this as a field in the collection.
// This is used as an identifier to recognize that property and treat it as page content
export const pageContentField: CollectionField = {
    type: "formattedText",
    id: "page-content",
    name: "Content",
}

// Naive implementation to be authenticated, a token could be expired.
// For simplicity we just close the plugin and clear storage in that case.
export function isAuthenticated() {
    return localStorage.getItem(notionBearerStorageKey) !== null
}

let notion: Client | null = null
if (isAuthenticated()) {
    initNotionClient()
}

export function initNotionClient() {
    const token = localStorage.getItem(notionBearerStorageKey)
    if (!token) throw new Error("Notion API token is missing")

    notion = new Client({
        fetch: async (url, fetchInit) => {
            const urlObj = new URL(url)

            try {
                const resp = await fetch(`${apiBaseUrl}/notion${urlObj.pathname}${urlObj.search}`, fetchInit)

                // If status is unauthorized, clear the token
                // And we close the plugin (for now)
                // TODO: Improve this flow in the plugin.
                if (resp.status === 401) {
                    localStorage.removeItem(notionBearerStorageKey)
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

export function getNotionClient() {
    if (!notion) throw new Error("Notion Client was used before it was initialized")

    return notion
}

// Authorize the plugin with Notion.
export async function authorize() {
    const resp = await fetch(`${apiBaseUrl}/auth/authorize`, {
        method: "POST",
    })

    const { readKey, writeKey } = await resp.json()
    return new Promise<void>(resolve => {
        window.open(getOauthURL(writeKey), "_blank")

        // Poll for the authorization status
        const interval = setInterval(async () => {
            const resp = await fetch(`${apiBaseUrl}/auth/authorize/${readKey}`)

            const { token } = await resp.json()

            if (resp.status === 200 && token) {
                clearInterval(interval)
                localStorage.setItem(notionBearerStorageKey, token)
                initNotionClient()
                resolve()
            }
        }, 2500)
    })
}

/**
 * Given a Notion Database Properties object returns a CollectionField object
 * That maps the Notion Property to the Framer CMS collection property type
 */
export function getCollectionFieldForProperty(
    property: GetDatabaseResponse["properties"][string]
): CollectionField | null {
    switch (property.type) {
        case "email":
        case "rich_text": {
            return {
                type: "formattedText",
                id: property.id,
                name: property.name,
            }
        }
        case "date":
        case "last_edited_time": {
            return {
                type: "date",
                id: property.id,
                name: property.name,
            }
        }
        case "select": {
            return {
                type: "enum",
                cases: property.select.options.map(option => ({
                    id: option.id,
                    name: option.name,
                })),
                id: property.id,
                name: property.name,
            }
        }
        case "number": {
            return {
                type: "number",
                id: property.id,
                name: property.name,
            }
        }
        case "checkbox": {
            return {
                type: "boolean",
                id: property.id,
                name: property.name,
            }
        }
        case "created_time": {
            return {
                type: "date",
                id: property.id,
                name: property.name,
            }
        }
        case "title":
            // The "title" field is required in Notion and is always used to set the "title" on the CMS item.
            return null
        case "multi_select":
        default: {
            // TODO: Support more types
            return null
        }
    }
}

export function richTextToPlainText(richText: RichTextItemResponse[]) {
    return richText.map(value => value.plain_text).join("")
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
    }
}

export interface SynchronizeMutationOptions {
    fields: CollectionField[]
    ignoredFieldIds: string[]
    lastSyncedTime: string | null
}

export interface ItemResult {
    url: string
    fieldId?: string
    message: string
}

interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}

export interface SynchronizeResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

async function getPageBlocksAsRichText(pageId: string) {
    assert(notion, "Notion client is not initialized")

    const blocks = await collectPaginatedAPI(notion.blocks.children.list, {
        block_id: pageId,
    })

    assert(blocks.every(isFullBlock)), "Response is not a full block"

    return blocksToHtml(blocks)
}

async function processItem(
    item: PageObjectResponse,
    fieldsById: FieldsById,
    status: SyncStatus,
    unsyncedItemIds: Set<string>,
    lastSyncedTime: string | null
): Promise<CollectionItem | null> {
    let slugValue: null | string = null
    let titleValue: null | string = null

    const fieldData: Record<string, unknown> = {}

    unsyncedItemIds.delete(item.id)
    assert(isFullPage(item))

    if (isUnchangedSinceLastSync(item.last_edited_time, lastSyncedTime)) {
        status.info.push({
            message: `Skipping. last updated: ${formatDate(item.last_edited_time)}, last synced: ${formatDate(lastSyncedTime!)}`,
            url: item.url,
        })
        return null
    }

    for (const key in item.properties) {
        const property = item.properties[key]
        assert(property)

        if (property.type === "title") {
            const resolvedTitle = getPropertyValue(property, { supportsHtml: false })
            if (!resolvedTitle || typeof resolvedTitle !== "string") {
                continue
            }

            titleValue = resolvedTitle
            slugValue = slugify(resolvedTitle)
        }

        const field = fieldsById.get(property.id)
        if (!field) {
            continue
        }

        const fieldValue = getPropertyValue(property, { supportsHtml: field.type === "formattedText" })
        if (!fieldValue) {
            status.warnings.push({
                url: item.url,
                fieldId: field.id,
                message: `Value is missing for field ${field.name}`,
            })
            continue
        }

        fieldData[field.id] = fieldValue
    }

    if (fieldsById.has(pageContentField.id) && item.id) {
        const contentHTML = await getPageBlocksAsRichText(item.id)
        fieldData[pageContentField.id] = contentHTML
    }

    if (!slugValue || !titleValue) {
        status.warnings.push({
            url: item.url,
            message: "Slug & Title is missing. Skipping item.",
        })
        return null
    }

    return {
        id: item.id,
        fieldData,
        slug: slugValue,
        title: titleValue,
    }
}

type FieldsById = Map<FieldId, CollectionField>

// Function to process all items concurrently with a limit
async function processAllItems(
    data: PageObjectResponse[],
    fieldsByKey: FieldsById,
    unsyncedItemIds: Set<FieldId>,
    concurrencyLimit = 5,
    lastSyncedDate: string | null
) {
    const limit = pLimit(concurrencyLimit)
    const status: SyncStatus = {
        errors: [],
        info: [],
        warnings: [],
    }
    const promises = data.map(item =>
        limit(() => processItem(item, fieldsByKey, status, unsyncedItemIds, lastSyncedDate))
    )
    const results = await Promise.all(promises)

    const collectionItems = results.filter(isDefined)

    return {
        collectionItems,
        status,
    }
}

export async function synchronizeDatabase(
    database: GetDatabaseResponse,
    { fields, ignoredFieldIds, lastSyncedTime }: SynchronizeMutationOptions
): Promise<SynchronizeResult> {
    assert(database)
    assert(notion)

    const collection = await framer.getCollection()
    await collection.setFields(fields)

    const fieldsById = new Map<string, CollectionField>()
    for (const field of fields) {
        fieldsById.set(field.id, field)
    }

    const unsyncedItemIds = new Set(await collection.getItemIds())

    const data = await collectPaginatedAPI(notion.databases.query, {
        database_id: database.id,
    })

    assert(data.every(isFullPage), "Response is not a full page")

    const { collectionItems, status } = await processAllItems(data, fieldsById, unsyncedItemIds, 5, lastSyncedTime)

    console.log("Submitting database")
    console.table(collectionItems)

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await collection.setPluginData(ignoredFieldIdsKey, JSON.stringify(ignoredFieldIds))
    await collection.setPluginData(pluginDatabaseIdKey, database.id)
    await collection.setPluginData(pluginLastSyncedKey, new Date().toISOString())

    return {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }
}

export function useSynchronizeDatabaseMutation(
    database: GetDatabaseResponse | null,
    { onSuccess }: { onSuccess?: (result: SynchronizeResult) => void } = {}
) {
    return useMutation({
        onError(error) {
            console.log("Sync failed:", error)
        },
        onSuccess,
        mutationFn: async (options: SynchronizeMutationOptions): Promise<SynchronizeResult> => {
            assert(database)

            return synchronizeDatabase(database, options)
        },
    })
}

export function useDatabasesQuery() {
    assert(notion)
    return useQuery({
        queryKey: ["databases"],
        queryFn: async () => {
            assert(notion)
            const results = await collectPaginatedAPI(notion.search, {
                filter: {
                    property: "object",
                    value: "database",
                },
            })

            return results.filter(isFullDatabase)
        },
    })
}

interface PluginContextNew {
    type: "new"
    collection: Collection
    isAuthenticated: boolean
}

export interface PluginContextUpdate {
    type: "update"
    database: GetDatabaseResponse
    collection: Collection
    collectionFields: CollectionField[]
    lastSyncedTime: string
    hasChangedFields: boolean
    ignoredFieldIds: FieldId[]
    isAuthenticated: boolean
}

export type PluginContext = PluginContextNew | PluginContextUpdate

function getIgnoredFieldIds(rawIgnoredFields: string | null) {
    if (!rawIgnoredFields) {
        return []
    }

    const parsed = JSON.parse(rawIgnoredFields)
    if (!Array.isArray(parsed)) return []
    if (!parsed.every(isString)) return []

    return parsed
}

function getSuggestedFieldsForDatabase(database: GetDatabaseResponse, ignoredFieldIds: FieldId[]) {
    const fields: CollectionField[] = [pageContentField]

    for (const key in database.properties) {
        // These fields were ignored by the user
        if (ignoredFieldIds.includes(key)) continue

        const property = database.properties[key]
        assert(property)

        if (property.type === "title") continue

        const field = getCollectionFieldForProperty(property)
        if (field) {
            fields.push(field)
        }
    }

    return fields
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getCollection()
    const collectionFields = await collection.getFields()
    const databaseId = await collection.getPluginData(pluginDatabaseIdKey)
    const hasAuthToken = isAuthenticated()

    if (!databaseId || !hasAuthToken) {
        return {
            type: "new",
            collection,
            isAuthenticated: hasAuthToken,
        }
    }

    assert(notion, "Notion client is not initialized")
    const database = await notion.databases.retrieve({ database_id: databaseId })

    const rawIgnoredFieldIds = await collection.getPluginData(ignoredFieldIdsKey)
    const lastSyncedTime = await collection.getPluginData(pluginLastSyncedKey)

    const ignoredFieldIds = getIgnoredFieldIds(rawIgnoredFieldIds)

    assert(lastSyncedTime, "Expected last synced time to be set")

    return {
        type: "update",
        database,
        collection,
        collectionFields,
        ignoredFieldIds,
        lastSyncedTime,
        hasChangedFields: hasFieldConfigurationChanged(collectionFields, database, ignoredFieldIds),
        isAuthenticated: hasAuthToken,
    }
}

export function hasFieldConfigurationChanged(
    currentConfig: CollectionField[],
    database: GetDatabaseResponse,
    ignoredFieldIds: string[]
): boolean {
    const currentFieldsById = new Map<string, CollectionField>()
    for (const field of currentConfig) {
        currentFieldsById.set(field.id, field)
    }

    const suggestedFields = getSuggestedFieldsForDatabase(database, ignoredFieldIds)
    const includedFields = suggestedFields.filter(field => currentFieldsById.has(field.id))

    if (includedFields.length !== currentConfig.length) return true
    for (const field of suggestedFields) {
        const currentField = currentFieldsById.get(field.id)

        if (!currentField) return true
        if (currentField.type !== field.type) return true
    }

    return false
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
