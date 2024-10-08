import {
    APIErrorCode,
    Client,
    collectPaginatedAPI,
    isFullBlock,
    isFullDatabase,
    isFullPage,
    isNotionClientError,
} from "@notionhq/client"
import pLimit from "p-limit"
import {
    BlockObjectResponse,
    GetDatabaseResponse,
    PageObjectResponse,
    RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"
import { assert, assertNever, formatDate, isDefined, isString, slugify } from "./utils"
import { ManagedCollectionField, CollectionItemData, framer, ManagedCollection } from "framer-plugin"
import { useMutation, useQuery } from "@tanstack/react-query"
import { blocksToHtml, richTextToHTML } from "./blocksToHTML"

export type FieldId = string

const apiBaseUrl = "https://notion-plugin-api.framer-team.workers.dev"
const oauthRedirectUrl = encodeURIComponent(`${apiBaseUrl}/auth/authorize/callback`)

export const getOauthURL = (writeKey: string) =>
    `https://api.notion.com/v1/oauth/authorize?client_id=3504c5a7-9f75-4f87-aa1b-b735f8480432&response_type=code&owner=user&redirect_uri=${oauthRedirectUrl}&state=${writeKey}`

// Storage for the notion API key.
const notionBearerStorageKey = "notionBearerToken"

const pluginDatabaseIdKey = "notionPluginDatabaseId"
const pluginLastSyncedKey = "notionPluginLastSynced"
const ignoredFieldIdsKey = "notionPluginIgnoredFieldIds"
const pluginSlugIdKey = "notionPluginSlugId"
const databaseNameKey = "notionDatabaseName"

// Maximum number of concurrent requests to Notion API
// This is to prevent rate limiting.
const concurrencyLimit = 5

export type NotionProperty = GetDatabaseResponse["properties"][string]

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
    return localStorage.getItem(notionBearerStorageKey) !== null
}

let notion: Client | null = null
if (isAuthenticated()) {
    initNotionClient()
}

export function getNotionProperties(database: GetDatabaseResponse) {
    const result: NotionProperty[] = []

    // Every page has content which is a rich text property. We add it as a
    // property so it displays in the list where you can disable properties To
    // be synchronize
    result.push(pageContentProperty)

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        result.push(property)
    }

    return result
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

// The order in which we display slug fields
const preferedSlugFieldOrder: NotionProperty["type"][] = ["title", "rich_text"]

/**
 * Given a Notion Database returns a list of possible fields that can be used as
 * a slug. And a suggested field id to use as a slug.
 */
export function getPossibleSlugFields(database: GetDatabaseResponse) {
    const options: NotionProperty[] = []

    const properties = getNotionProperties(database)
    for (const property of properties) {
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

// Authorize the plugin with Notion.
export async function authorize(options: { readKey: string; writeKey: string }) {
    await fetch(`${apiBaseUrl}/auth/authorize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
    })

    return new Promise<void>(resolve => {
        // Poll for the authorization status
        const interval = setInterval(async () => {
            const resp = await fetch(`${apiBaseUrl}/auth/authorize/${options.readKey}`)

            const { token } = await resp.json()

            if (resp.status === 200 && token) {
                clearInterval(interval)
                localStorage.setItem(notionBearerStorageKey, token)
                initNotionClient()
                resolve()
            }
        }, 10_000)
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
] satisfies NotionProperty["type"][]

type SupportedPropertyType = (typeof supportedNotionPropertyTypes)[number]
type SupportedNotionProperty = Extract<NotionProperty, { type: SupportedPropertyType }>

export function isSupportedNotionProperty(property: NotionProperty): property is SupportedNotionProperty {
    return supportedNotionPropertyTypes.includes(property.type as SupportedPropertyType)
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

/**
 * Given a Notion Database Properties object returns a CollectionField object
 * That maps the Notion Property to the Framer CMS collection property type
 */
export function getCollectionFieldForProperty<
    TProperty extends Extract<NotionProperty, { type: SupportedPropertyType }>,
>(property: TProperty, fieldType: ManagedCollectionField["type"]): ManagedCollectionField | null {
    switch (property.type) {
        case "email":
        case "rich_text": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: fieldType,
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "date":
        case "last_edited_time": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "date",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "select": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "enum",
                cases: property.select.options.map(option => ({
                    id: option.id,
                    name: option.name,
                })),
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "number": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "number",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "checkbox": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "boolean",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "created_time": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "date",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "title": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)
            return {
                type: "string",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "status": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "enum",
                id: property.id,
                name: property.name,
                cases: property.status.groups.map(group => {
                    return {
                        id: group.id,
                        name: group.name,
                    }
                }),
                userEditable: false,
            }
        }
        case "url": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "link",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "files": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            if (fieldType === "file") {
                return {
                    type: fieldType,
                    id: property.id,
                    name: property.name,
                    userEditable: false,
                    allowedFileTypes: [],
                }
            }

            return {
                type: fieldType,
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        default: {
            assertNever(property)

            // More Field types can be added here
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
        case "files": {
            const firstFile = property.files[0]
            if (!firstFile) return ""

            if (firstFile.type === "external") {
                return firstFile.external.url
            }

            if (firstFile.type === "file") {
                return firstFile.file.url
            }
        }
    }
}

export interface SynchronizeProgress {
    totalCount: number
    completedCount: number
    completedPercent: number
}

type OnProgressHandler = (progress: SynchronizeProgress) => void

export interface SynchronizeMutationOptions {
    fields: ManagedCollectionField[]
    ignoredFieldIds: string[]
    lastSyncedTime: string | null
    slugFieldId: string
    onProgress: OnProgressHandler
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

    const iterator = iteratePaginatedAPI(notion.blocks.children.list, {
        block_id: pageId,
    })

    const blocks: BlockObjectResponse[] = []
    for await (const block of iterator) {
        if (!isFullBlock(block)) continue
        blocks.push(block)
    }

    assert(blocks.every(isFullBlock), "Response is not a full block")

    return blocksToHtml(blocks)
}

async function processItem(
    item: PageObjectResponse,
    fieldsById: FieldsById,
    slugFieldId: string,
    status: SyncStatus
): Promise<CollectionItemData | null> {
    let slugValue: null | string = null

    const fieldData: Record<string, unknown> = {}

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

        const fieldValue = getPropertyValue(property, { supportsHtml: field.type === "formattedText" })
        if (fieldValue === null) {
            status.warnings.push({
                url: item.url,
                fieldId: field.id,
                message: `Value is missing for field ${field.name}`,
            })
            continue
        }

        fieldData[field.id] = fieldValue
    }

    if (fieldsById.has(pageContentProperty.id) && item.id) {
        const contentHTML = await getPageBlocksAsRichText(item.id)
        fieldData[pageContentProperty.id] = contentHTML
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

async function processAllItems(
    data: PageObjectResponse[],
    fieldsByKey: FieldsById,
    slugFieldId: string,
    lastSyncedDate: string | null,
    onProgress: OnProgressHandler
) {
    const seenItemIds = new Set<string>()
    const limit = pLimit(concurrencyLimit)
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

    const collectionItems = results.filter(isDefined)

    return {
        collectionItems,
        status,
        seenItemIds,
    }
}

export function hasFieldConfigurationChanged(a: ManagedCollectionField[], b: ManagedCollectionField[]) {
    if (a.length !== b.length) return true

    for (let i = 0; i < a.length; i++) {
        const fieldA = a[i]
        const fieldB = b[i]

        if (fieldA.id !== fieldB.id) return true
        if (fieldA.type !== fieldB.type) return true
    }

    return false
}

export async function synchronizeDatabase(
    database: GetDatabaseResponse,
    { fields, ignoredFieldIds, lastSyncedTime, slugFieldId, onProgress }: SynchronizeMutationOptions
): Promise<SynchronizeResult> {
    assert(isFullDatabase(database))
    assert(notion)

    const collection = await framer.getManagedCollection()
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

    console.table(collectionItems)

    await collection.addItems(collectionItems)
    await collection.removeItems(Array.from(itemIdsToDelete))

    await Promise.all([
        collection.setPluginData(ignoredFieldIdsKey, JSON.stringify(ignoredFieldIds)),
        collection.setPluginData(pluginDatabaseIdKey, database.id),
        collection.setPluginData(pluginLastSyncedKey, new Date().toISOString()),
        collection.setPluginData(pluginSlugIdKey, slugFieldId),
        collection.setPluginData(databaseNameKey, richTextToPlainText(database.title)),
    ])

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
            framer.closePlugin("Failed to synchronize with Notion: " + error.message, { variant: "error" })
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

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    isAuthenticated: boolean
}

export interface PluginContextUpdate {
    type: "update"
    database: GetDatabaseResponse
    collection: ManagedCollection
    collectionFields: ManagedCollectionField[]
    lastSyncedTime: string
    hasChangedFields: boolean
    ignoredFieldIds: FieldId[]
    slugFieldId: string | null
    isAuthenticated: boolean
}

export interface PluginContextError {
    type: "error"
    message: string
    isAuthenticated: false
}

export type PluginContext = PluginContextNew | PluginContextUpdate | PluginContextError

function getIgnoredFieldIds(rawIgnoredFields: string | null) {
    if (!rawIgnoredFields) {
        return []
    }

    const parsed = JSON.parse(rawIgnoredFields)
    if (!Array.isArray(parsed)) return []
    if (!parsed.every(isString)) return []

    return parsed
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
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

    try {
        assert(notion, "Notion client is not initialized")
        const database = await notion.databases.retrieve({ database_id: databaseId })

        const [rawIgnoredFieldIds, lastSyncedTime, slugFieldId] = await Promise.all([
            collection.getPluginData(ignoredFieldIdsKey),
            collection.getPluginData(pluginLastSyncedKey),
            collection.getPluginData(pluginSlugIdKey),
        ])

        const ignoredFieldIds = getIgnoredFieldIds(rawIgnoredFieldIds)

        assert(lastSyncedTime, "Expected last synced time to be set")

        return {
            type: "update",
            database,
            collection,
            collectionFields,
            ignoredFieldIds,
            lastSyncedTime,
            slugFieldId,
            hasChangedFields: hasDatabaseFieldsChanged(collectionFields, database, ignoredFieldIds),
            isAuthenticated: hasAuthToken,
        }
    } catch (error) {
        if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
            const databaseName = (await collection.getPluginData(databaseNameKey)) ?? "Unkown"

            return {
                type: "error",
                message: `The database "${databaseName}" was not found. Log in with Notion and select the Database to sync.`,
                isAuthenticated: false,
            }
        }

        throw error
    }
}

export function hasDatabaseFieldsChanged(
    currentFields: ManagedCollectionField[],
    database: GetDatabaseResponse,
    ignoredFieldIds: string[]
): boolean {
    const currentFieldsById = new Map<string, ManagedCollectionField>()
    for (const field of currentFields) {
        currentFieldsById.set(field.id, field)
    }

    const properties = getNotionProperties(database)

    const supportedfieldsById: Map<string, ManagedCollectionField["type"][]> = new Map()
    for (const property of properties) {
        if (!isSupportedNotionProperty(property)) continue
        if (ignoredFieldIds.includes(property.id)) continue

        const supportedFieldTypes = supportedCMSTypeByNotionPropertyType[property.type]
        if (!supportedFieldTypes.length) continue

        supportedfieldsById.set(property.id, supportedFieldTypes)
    }

    if (supportedfieldsById.size !== currentFields.length) return true

    for (const [fieldId, supportedFieldTypes] of supportedfieldsById) {
        const currentField = currentFieldsById.get(fieldId)

        // A new Field was added
        if (!currentField) return true

        // The supported field Types of this field changed.
        if (!supportedFieldTypes.includes(currentField.type)) return true
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

interface PaginatedArgs {
    start_cursor?: string
}

interface PaginatedList<T> {
    object: "list"
    results: T[]
    next_cursor: string | null
    has_more: boolean
}

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
            console.warn("Notion has a bug with pagination")
            return
        }

        seenCursors.add(response.next_cursor)
        nextCursor = response.next_cursor
    } while (nextCursor)
}
