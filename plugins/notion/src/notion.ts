import { Client, collectPaginatedAPI, isFullBlock, isFullDatabase, isFullPage } from "@notionhq/client"
import pLimit from "p-limit"
import { GetDatabaseResponse, PageObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints"
import { assert, formatDate, isDefined, isString, slugify } from "./utils"
import { Collection, CollectionField, CollectionItem, framer } from "framer-plugin"
import { useMutation, useQuery } from "@tanstack/react-query"
import { blocksToHtml, richTextToHTML } from "./blocksToHTML"

export type FieldId = string

// TODO: Restrict to be a more specific notion proxy instead of just a CORS proxy
const corsProxy = "https://cors-proxy.niekkruse70.workers.dev"

// NOTE: Changing these keys can break behavior of existing plugins.
const pluginDatabaseIdKey = "notionPluginDatabaseId"
const pluginLastSyncedKey = "notionPluginLastSynced"
const ignoredFieldIdsKey = "notionPluginIgnoredFieldIds"
const pluginSlugIdKey = "notionPluginSlugId"

// A page in database consists of blocks.
// We allow configuration to include this as a field in the collection.
// This is used as an identifier to recognize that property and treat it as page content
export const pageContentField: CollectionField = {
    type: "formattedText",
    id: "page-content",
    name: "Content",
}

export const notionClient = new Client({
    fetch: async (url, fetchInit) => {
        try {
            return await fetch(`${corsProxy}?url=${url}`, fetchInit)
        } catch (error) {
            console.log("Notion API error", error)
            throw error
        }
    },
    auth: import.meta.env.VITE_NOTION_INTEGRATION_SECRET,
})

interface SlugField {
    name: string
    id: FieldId
}

/**
 * Given a Notion Database returns a list of possible fields that can be used as
 * a slug. And a suggested field id to use as a slug.
 */
export function getPossibleSlugFields(database: GetDatabaseResponse) {
    let suggestedFieldId: FieldId | null = null
    const options: SlugField[] = []

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        const field: SlugField = {
            name: property.name,
            id: property.id,
        }

        switch (property.type) {
            // TODO: Other field types that qualify as slug?
            case "unique_id":
                options.push(field)
                break
            case "title":
                options.push(field)
                suggestedFieldId = field.id
        }
    }

    return { options, suggestedFieldId }
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
        case "title": {
            return {
                type: "string",
                id: property.id,
                name: property.name,
            }
        }
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
    slugFieldId: string
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
    const blocks = await collectPaginatedAPI(notionClient.blocks.children.list, {
        block_id: pageId,
    })

    assert(blocks.every(isFullBlock)), "Response is not a full block"

    return blocksToHtml(blocks)
}

async function processItem(
    item: PageObjectResponse,
    fieldsById: FieldsById,
    slugFieldId: string,
    status: SyncStatus,
    unsyncedItemIds: Set<string>,
    lastSyncedTime: string | null
): Promise<CollectionItem | null> {
    let slugValue = null
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

        if (property.id === slugFieldId) {
            const resolvedSlug = getPropertyValue(property, { supportsHtml: false })
            if (!resolvedSlug || typeof resolvedSlug !== "string") {
                continue
            }
            slugValue = slugify(resolvedSlug)
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

    if (!slugValue) {
        status.warnings.push({
            url: item.url,
            fieldId: slugFieldId,
            message: "Slug value is missing. Skipping item.",
        })
        return null
    }

    return {
        id: item.id,
        fieldData,
        slug: slugValue,
    }
}

type FieldsById = Map<FieldId, CollectionField>

// Function to process all items concurrently with a limit
async function processAllItems(
    data: PageObjectResponse[],
    fieldsByKey: FieldsById,
    unsyncedItemIds: Set<FieldId>,
    slugFieldId: FieldId,
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
        limit(() => processItem(item, fieldsByKey, slugFieldId, status, unsyncedItemIds, lastSyncedDate))
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
    { slugFieldId, fields, ignoredFieldIds, lastSyncedTime }: SynchronizeMutationOptions
): Promise<SynchronizeResult> {
    assert(database)

    const collection = await framer.getCollection()
    await collection.setFields(fields)

    const fieldsById = new Map<string, CollectionField>()
    for (const field of fields) {
        fieldsById.set(field.id, field)
    }

    const unsyncedItemIds = new Set(await collection.getItemIds())

    const data = await collectPaginatedAPI(notionClient.databases.query, {
        database_id: database.id,
    })

    assert(data.every(isFullPage), "Response is not a full page")

    const { collectionItems, status } = await processAllItems(
        data,
        fieldsById,
        unsyncedItemIds,
        slugFieldId,
        5,
        lastSyncedTime
    )

    console.log("Submitting database")
    console.table(collectionItems)

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await collection.setPluginData(ignoredFieldIdsKey, JSON.stringify(ignoredFieldIds))
    await collection.setPluginData(pluginDatabaseIdKey, database.id)
    await collection.setPluginData(pluginLastSyncedKey, new Date().toISOString())
    await collection.setPluginData(pluginSlugIdKey, slugFieldId)

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
    return useQuery({
        queryKey: ["databases"],
        queryFn: async () => {
            const results = await collectPaginatedAPI(notionClient.search, {
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
}

export interface PluginContextUpdate {
    type: "update"
    database: GetDatabaseResponse
    collection: Collection
    collectionFields: CollectionField[]
    lastSyncedTime: string
    hasChangedFields: boolean
    ignoredFieldIds: FieldId[]
    slugFieldId: FieldId
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

    if (!databaseId) {
        return {
            type: "new",
            collection,
        }
    }

    const database = await notionClient.databases.retrieve({ database_id: databaseId })
    const slugFieldId = await collection.getPluginData(pluginSlugIdKey)
    const rawIgnoredFieldIds = await collection.getPluginData(ignoredFieldIdsKey)
    const lastSyncedTime = await collection.getPluginData(pluginLastSyncedKey)

    const ignoredFieldIds = getIgnoredFieldIds(rawIgnoredFieldIds)

    assert(slugFieldId, "Expected slug field ID to be set")
    assert(lastSyncedTime, "Expected last synced time to be set")

    return {
        type: "update",
        database,
        collection,
        collectionFields,
        ignoredFieldIds,
        slugFieldId,
        lastSyncedTime,
        hasChangedFields: hasFieldConfigurationChanged(collectionFields, database, ignoredFieldIds),
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
