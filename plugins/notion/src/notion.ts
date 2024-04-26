import { Client, collectPaginatedAPI, isFullDatabase, isFullPage } from "@notionhq/client"
import { GetDatabaseResponse, PageObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints"
import { assert, isString, slugify } from "./utils"
import { Collection, CollectionField, CollectionItem, framer } from "framer-plugin"
import { useMutation, useQuery } from "@tanstack/react-query"

// TODO: Restrict to be a more specific notion proxy instead of just a CORS proxy
const corsProxy = "https://cors-proxy.niekkruse70.workers.dev"

// NOTE: Changing these keys can break behavior of existing plugins.
const pluginDatabaseIdKey = "notionPluginDatabaseId"
const pluginLastSyncedKey = "notionPluginLastSynced"
const ignoredFieldIdsKey = "notionPluginIgnoredFieldIds"

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
    id: string
}

export function getPossibleSlugFields(database: GetDatabaseResponse) {
    let suggestedFieldId: string | null = null
    const options: SlugField[] = []

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        const field: SlugField = {
            name: property.name,
            id: property.id,
        }

        switch (property.type) {
            // TODO: Others?
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

export function getCollectionFieldForProperty(
    property: GetDatabaseResponse["properties"][string]
): CollectionField | null {
    switch (property.type) {
        case "email":
        case "title": {
            return {
                type: "string",
                key: property.id,
                name: property.name,
            }
        }
        case "rich_text": {
            return {
                type: "string",
                key: property.id,
                name: property.name,
            }
        }
        case "date":
        case "last_edited_time": {
            return {
                type: "date",
                key: property.id,
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
                key: property.id,
                name: property.name,
            }
        }
        case "checkbox": {
            return {
                type: "boolean",
                key: property.id,
                name: property.name,
            }
        }
        case "multi_select":
        default: {
            return null
        }
    }
}

export function richTextToPlainText(richText: RichTextItemResponse[]) {
    return richText.map(value => value.plain_text).join("")
}

export function getPropertyValue(property: PageObjectResponse["properties"][string]): unknown | undefined {
    // TODO: Support rich text to richt text
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
            return richTextToPlainText(property.rich_text)
        }
        case "select": {
            if (!property.select) return null

            return property.select.id
        }
        case "title":
            return richTextToPlainText(property.title)
        case "number": {
            return `${property.number}`
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
}

export interface ItemMessage {
    itemId: string
    message: string
}

interface SynchronizeSuccessResult {
    status: "success"
}

interface SynchronizeSuccessWithErrorResult {
    status: "completed_with_errors"
    errors: ItemMessage[]
}

type SynchronizeResult = SynchronizeSuccessResult | SynchronizeSuccessWithErrorResult

export function useSynchronizeDatabaseMutation(
    database: GetDatabaseResponse | null,
    { onSuccess }: { onSuccess?: (result: SynchronizeResult) => void } = {}
) {
    return useMutation({
        onError(error) {
            console.log("Sync failed:", error)
        },
        onSuccess,
        mutationFn: async ({
            slugFieldId,
            fields,
            ignoredFieldIds,
        }: SynchronizeMutationOptions): Promise<SynchronizeResult> => {
            assert(database)

            const collection = await framer.getCollection()
            await collection.setFields(fields)

            const fieldsByKey = new Map<string, CollectionField>()
            for (const field of fields) {
                fieldsByKey.set(field.key, field)
            }

            const unsyncedItemIds = new Set(await collection.getItemIds())

            const data = await collectPaginatedAPI(notionClient.databases.query, {
                database_id: database.id,
            })

            // TODO: handle more types?

            const itemErrors: ItemMessage[] = []
            const itemWarnings: ItemMessage[] = []
            const collectionItems: CollectionItem[] = []

            for (const item of data) {
                let slugValue: string | null = null
                // todo: relations?
                assert(isFullPage(item))

                const fieldData: CollectionItem["fieldData"] = {}

                for (const key in item.properties) {
                    const property = item.properties[key]
                    assert(property)

                    if (property.id === slugFieldId) {
                        const resolvedSlug = getPropertyValue(property)
                        if (!resolvedSlug || typeof resolvedSlug !== "string") {
                            // Field without slug
                            continue
                        }

                        slugValue = slugify(resolvedSlug)
                    }

                    const field = fieldsByKey.get(property.id)
                    if (!field) {
                        continue
                    }

                    const fieldValue = getPropertyValue(property)
                    if (!fieldValue) {
                        itemWarnings.push({
                            itemId: field.key,
                            message: `Value is missing for field ${field.name}`,
                        })
                        continue
                    }

                    fieldData[field.key] = fieldValue
                }

                if (!slugValue) {
                    continue
                }

                // Mark item as seen
                unsyncedItemIds.delete(item.id)

                collectionItems.push({
                    id: item.id,
                    fieldData,
                    slug: slugValue,
                })
            }

            console.log("Submitting database")
            console.table(collectionItems)

            await collection.addItems(collectionItems)

            const itemsToDelete = Array.from(unsyncedItemIds)
            await collection.removeItems(itemsToDelete)

            await collection.setPluginData(ignoredFieldIdsKey, JSON.stringify(ignoredFieldIds))
            await collection.setPluginData(pluginDatabaseIdKey, database.id)
            await collection.setPluginData(pluginLastSyncedKey, new Date().toISOString())

            return {
                status: itemErrors.length === 0 ? "success" : "completed_with_errors",
                errors: itemErrors,
            }
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

            // TODO: pagination.
            return results.filter(isFullDatabase)
        },
    })
}

export interface PluginConfig {
    database: GetDatabaseResponse | null
    collection: Collection
    collectionFields: CollectionField[]
    ignoredFieldIds: string[]
}

function getIgnoredFieldIds(rawIgnoredFields: string | null) {
    if (!rawIgnoredFields) {
        return []
    }

    const parsed = JSON.parse(rawIgnoredFields)
    if (!Array.isArray(parsed)) return []
    if (!parsed.every(isString)) return []

    return parsed
}

export async function getPluginConfig(): Promise<PluginConfig> {
    const collection = await framer.getCollection()
    const collectionFields = await collection.getFields()
    const databaseId = await collection.getPluginData(pluginDatabaseIdKey)

    const rawIgnoredFieldIds = await collection.getPluginData(ignoredFieldIdsKey)

    const ignoredFieldIds = getIgnoredFieldIds(rawIgnoredFieldIds)

    if (!databaseId) {
        return { database: null, collectionFields, collection, ignoredFieldIds }
    }

    const database = await notionClient.databases.retrieve({ database_id: databaseId })

    return { database, collection, collectionFields, ignoredFieldIds }
}
