import {
    APIErrorCode,
    Client,
    collectPaginatedAPI,
    isFullBlock,
    isFullDatabase,
    isFullPage,
    isNotionClientError,
} from "@notionhq/client"
import {
    type BlockObjectResponse,
    type GetDatabaseResponse,
    type PageObjectResponse,
    type RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
    type FieldDataEntryInput,
    type FieldDataInput,
    type ManagedCollection,
    type ManagedCollectionField,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
    framer,
} from "framer-plugin"
import pLimit from "p-limit"
import { blocksToHtml, richTextToHTML } from "./blocksToHTML"
import { assert, assertNever, formatDate, isDefined, isString, slugify } from "./utils"

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

const pageCoverImageId = "page-cover"
export const pageCoverImageProperty: SupportedNotionProperty = {
    type: "cover-image",
    id: pageCoverImageId,
    name: "Cover Image",
    description: "Page Cover Image",
}

export const imageFileExtensions = ["jpg", "jpeg", "png", "gif", "apng", "webp", "svg"]

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

    // These properties are always there but not included in `"database.properties"
    result.push(pageContentProperty, pageCoverImageProperty)

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
    "relation",
    "phone_number",
    "unique_id",
    "people",
    "created_by",
    "last_edited_by",
] satisfies ReadonlyArray<NotionProperty["type"]>

type SupportedPropertyType = (typeof supportedNotionPropertyTypes)[number]
type CustomPropertyType = "cover-image"

type SupportedNotionProperty =
    | Extract<NotionProperty, { type: SupportedPropertyType }>
    | { type: CustomPropertyType; id: string; name: string; description: string }

export function isSupportedNotionProperty(
    property: NotionProperty | { type: CustomPropertyType }
): property is SupportedNotionProperty {
    if (property.type === "cover-image") return true
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
    email: ["string", "formattedText"],
    files: ["file", "image"],
    relation: ["multiCollectionReference"],
    phone_number: ["string"],
    unique_id: ["string", "number"],
    people: ["string"],
    created_by: ["string"],
    last_edited_by: ["string"],
    "cover-image": ["image"],
} satisfies Record<SupportedPropertyType | CustomPropertyType, ReadonlyArray<ManagedCollectionField["type"]>>

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
    TProperty extends Extract<NotionProperty, { type: SupportedPropertyType | CustomPropertyType }>
>(
    property: TProperty,
    fieldType: ManagedCollectionField["type"],
    databaseIdMap: DatabaseIdMap
): ManagedCollectionFieldInput | null {
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
                cases: property.status.options.map(option => {
                    return {
                        id: option.id,
                        name: option.name,
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
        case "relation": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            const collectionId = databaseIdMap.get(property.relation.database_id)

            if (!collectionId) {
                // Database includes a relation to a database that hasn't been synced to Framer.
                // TODO: It would be better to surface this error to the user in
                // the UI instead of just skipping the field.
                return null
            }

            return {
                type: "multiCollectionReference",
                id: property.id,
                name: property.name,
                collectionId: collectionId,
                userEditable: false,
            }
        }
        case "phone_number": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "string",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "unique_id": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: fieldType,
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "cover-image": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)

            return {
                type: "image",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "people": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)
            return {
                type: "string",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "created_by": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)
            return {
                type: "string",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        case "last_edited_by": {
            assertFieldTypeMatchesPropertyType(property.type, fieldType)
            return {
                type: "string",
                id: property.id,
                name: property.name,
                userEditable: false,
            }
        }
        default: {
            assertNever(property)
        }
    }
}

export function richTextToPlainText(richText: RichTextItemResponse[]) {
    return richText.map(value => value.plain_text).join("")
}

export function getFieldDataEntryInput(
    property: PageObjectResponse["properties"][string],
    fieldType: ManagedCollectionField["type"]
): FieldDataEntryInput | undefined {
    switch (property.type) {
        case "checkbox": {
            return {
                type: "boolean",
                value: property.checkbox,
            }
        }
        case "last_edited_time": {
            return {
                type: "date",
                value: property.last_edited_time,
            }
        }
        case "created_time": {
            return {
                type: "date",
                value: property.created_time,
            }
        }
        case "rich_text": {
            if (supportsHtml) {
                return richTextToHTML(property.rich_text)
            }

            return richTextToPlainText(property.rich_text)
        }
        case "email": {
            if (supportsHtml) {
                return `<p>${property.email ?? ""}</p>`
            }

            return property.email ?? ""
        }
        case "select": {
            if (!property.select) return undefined

            return {
                type: "enum",
                value: property.select.id,
            }
        }
        case "status": {
            if (!property.status) return null

            return property.status.id
        }
        case "title":
            if (fieldType === "formattedText") {
                return {
                    type: "formattedText",
                    value: richTextToHTML(property.title),
                }
            }

            return {
                type: "string",
                value: richTextToPlainText(property.title),
            }
        case "number": {
            if (property.number === null) return undefined
            return {
                type: "number",
                value: property.number,
            }
        }
        case "url": {
            return {
                type: "link",
                value: property.url,
            }
        }
        case "unique_id": {
            if (fieldType === "string") {
                return property.unique_id.prefix
                    ? `${property.unique_id.prefix}-${property.unique_id.number}`
                    : String(property.unique_id.number)
            }

            return property.unique_id.number
        }
        case "date": {
            return {
                type: "date",
                value: property.date?.start ?? null,
            }
        }
        case "relation": {
            return {
                type: "multiCollectionReference",
                value: property.relation.map(({ id }) => id),
            }
        }
        case "files": {
            for (const file of property.files) {
                let url = ""

                if (file.type === "external") {
                    url = file.external.url
                } else if (file.type === "file") {
                    url = file.file.url
                }
            }

            const isFileOrImage = fieldType === "file" || fieldType === "image"
            if (firstFile.type === "file" && isFileOrImage) {
                return {
                    type: fieldType,
                    value: firstFile.file.url,
                }
            }
            return ""
        }
        case "phone_number": {
            return property.phone_number ?? ""
        }
        case "people": {
            const firstUser = property.people[0]
            if (!firstUser) return ""
            return "name" in firstUser ? firstUser.name : ""
        }
        case "created_by": {
            return "name" in property.created_by ? property.created_by.name : ""
        }
        case "last_edited_by": {
            return "name" in property.last_edited_by ? property.last_edited_by.name : ""
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
    fields: ManagedCollectionFieldInput[]
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

async function processItem(
    item: PageObjectResponse,
    fieldsById: FieldsById,
    slugFieldId: string,
    status: SyncStatus
): Promise<ManagedCollectionItemInput | null> {
    let slugValue: null | string = null

    const fieldData: FieldDataInput = {}

    assert(isFullPage(item))

    for (const key in item.properties) {
        const property = item.properties[key]
        assert(property)

        if (property.id === slugFieldId) {
            const resolvedSlug = getFieldDataEntryInput(property, "string")
            assert(typeof resolvedSlug?.value === "string", "Slug value is not a string")
            slugValue = slugify(resolvedSlug.value as string)
        }

        const field = fieldsById.get(property.id)

        // We can continue if the property was not included in the field mapping
        if (!field) {
            continue
        }

        const fieldValue = getPropertyValue(property, { fieldType: field.type })
        if (fieldValue === null || fieldValue === undefined) {
            status.warnings.push({
                url: item.url,
                fieldId: field.id,
                message: `Value is missing for field ${field.name}`,
            })
            continue
        }

        fieldData[field.id] = fieldDataEntry
    }

    if (fieldsById.has(pageContentProperty.id) && item.id) {
        const contentHTML = await getPageBlocksAsRichText(item.id)
        fieldData[pageContentProperty.id] = {
            type: "formattedText",
            value: contentHTML,
        }
    }

    if (fieldsById.has(pageCoverImageProperty.id) && item.cover) {
        if (item.cover.type === "external") {
            fieldData[pageCoverImageProperty.id] = { type: "image", value: item.cover.external.url }
        } else if (item.cover.type === "file") {
            fieldData[pageCoverImageProperty.id] = { type: "image", value: item.cover.file.url }
        }
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

type FieldsById = Map<FieldId, ManagedCollectionFieldInput>

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

export function hasFieldConfigurationChanged(a: ManagedCollectionFieldInput[], b: ManagedCollectionFieldInput[]) {
    if (a.length !== b.length) return true

    for (let i = 0; i < a.length; i++) {
        const fieldA = a[i]
        const fieldB = b[i]
        assert(fieldA, "Field A is undefined")
        assert(fieldB, "Field B is undefined")

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

    const collection = await framer.getActiveManagedCollection()

    const fieldsById = new Map<string, ManagedCollectionFieldInput>()
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
    { onSuccess, onError }: { onSuccess?: (result: SynchronizeResult) => void; onError?: (error: Error) => void } = {}
) {
    return useMutation({
        onSuccess,
        onError,
        mutationFn: async (options: SynchronizeMutationOptions): Promise<SynchronizeResult> => {
            assert(database)

            const collection = await framer.getActiveManagedCollection()
            await collection.setFields(options.fields)
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
    databaseIdMap: DatabaseIdMap
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
    databaseIdMap: DatabaseIdMap
}

export interface PluginContextError {
    type: "error"
    message: string
    isAuthenticated: false
    databaseIdMap: DatabaseIdMap
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

export type DatabaseIdMap = Map<string, string>

export async function getDatabaseIdMap(): Promise<DatabaseIdMap> {
    const databaseIdMap: DatabaseIdMap = new Map()

    for (const collection of await framer.getCollections()) {
        const collectionDatabaseId = await collection.getPluginData(pluginDatabaseIdKey)
        if (!collectionDatabaseId) continue

        databaseIdMap.set(collectionDatabaseId, collection.id)
    }

    return databaseIdMap
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()
    const databaseId = await collection.getPluginData(pluginDatabaseIdKey)
    const hasAuthToken = isAuthenticated()

    const databaseIdMap = await getDatabaseIdMap()

    if (!databaseId || !hasAuthToken) {
        return {
            type: "new",
            collection,
            isAuthenticated: hasAuthToken,
            databaseIdMap,
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
            databaseIdMap,
        }
    } catch (error) {
        if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
            const databaseName = (await collection.getPluginData(databaseNameKey)) ?? "Unkown"

            return {
                type: "error",
                message: `The database "${databaseName}" was not found. Log in with Notion and select the Database to sync.`,
                isAuthenticated: false,
                databaseIdMap,
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
