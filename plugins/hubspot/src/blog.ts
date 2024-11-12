import { framer, ManagedCollection, ManagedCollectionField } from "framer-plugin"
import { fetchAllBlogPosts, HSBlogPost } from "./api"
import { isDefined, parseJsonToArray } from "./utils"
import { FieldsById, logSyncResult, MAX_CMS_ITEMS, richTextToHTML, SyncResult, SyncStatus } from "./cms"

export const PLUGIN_INCLUDED_FIELD_IDS = "hubspotPluginBlogIncludedFieldIds"

export interface SyncBlogParams {
    fields: ManagedCollectionField[]
    includedFieldIds: string[]
}

export interface ProcessPostParams {
    fields: ManagedCollectionField[]
    post: HSBlogPost
    fieldsById: FieldsById
    status: SyncStatus
    unsyncedItemIds: Set<string>
}

export interface BlogPluginContextNew {
    type: "new"
    collection: ManagedCollection
}

export interface BlogPluginContextUpdate {
    type: "update"
    collection: ManagedCollection
    collectionFields: ManagedCollectionField[]
    includedFieldIds: string[]
}

export type BlogPluginContext = BlogPluginContextNew | BlogPluginContextUpdate

export function shouldSyncBlogImmediately(pluginContext: BlogPluginContext): pluginContext is BlogPluginContextUpdate {
    if (pluginContext.type !== "update") return false

    return true
}

export async function getBlogPluginContext(): Promise<BlogPluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()

    const rawIncludedFields = await collection.getPluginData(PLUGIN_INCLUDED_FIELD_IDS)
    const includedFieldIds = parseJsonToArray<string>(rawIncludedFields)

    if (!includedFieldIds) {
        return {
            type: "new",
            collection,
        }
    }

    return {
        type: "update",
        collection,
        collectionFields,
        includedFieldIds,
    }
}

function processPost({ post, fieldsById, unsyncedItemIds, status }: ProcessPostParams) {
    let slugValue: string | null = null
    const fieldData: Record<string, unknown> = {}

    unsyncedItemIds.delete(post.id)

    for (const [propertyName, propertyValue] of Object.entries(post)) {
        if (propertyName === "slug") {
            if (typeof propertyValue !== "string") continue

            slugValue = propertyValue
        }

        const field = fieldsById.get(propertyName)

        // Not included in field mapping, skip
        if (!field) continue

        if (!propertyValue) {
            status.warnings.push({
                fieldName: propertyValue,
                message: `Value is missing for field ${field.name}`,
            })
        }

        let fieldValue
        switch (field.type) {
            case "formattedText":
                fieldValue = richTextToHTML(propertyValue)
                break
            default:
                fieldValue = propertyValue
        }

        fieldData[propertyName] = fieldValue
    }

    if (!slugValue) {
        status.warnings.push({
            message: "Slug missing. Skipping item.",
        })

        return null
    }

    return {
        id: post.id,
        slug: slugValue,
        fieldData,
    }
}

function processBlog(posts: HSBlogPost[], processBlogParams: Omit<ProcessPostParams, "post" | "status">) {
    const seenItemIds = new Set<string>()
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }

    const collectionItems = posts.map(post => processPost({ post, status, ...processBlogParams })).filter(isDefined)

    return {
        collectionItems,
        status,
        seenItemIds,
    }
}

export async function syncBlogs({ fields, includedFieldIds }: SyncBlogParams) {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map(fields.map(field => [field.id, field]))
    const unsyncedItemIds = new Set(await collection.getItemIds())
    // We need the ID, so include it regardless. We don't include slug explicitly since it's always included.
    // Included field Ids are also the names of the HubSpot blog field properties since field names are unique.
    const { results: posts } = await fetchAllBlogPosts(MAX_CMS_ITEMS, Array.from(new Set([...includedFieldIds, "id"])))
    const { collectionItems, status } = processBlog(posts, {
        fields,
        fieldsById,
        unsyncedItemIds,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await collection.setPluginData(PLUGIN_INCLUDED_FIELD_IDS, JSON.stringify(Array.from(includedFieldIds)))

    const result: SyncResult = {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }

    logSyncResult(result, collectionItems)

    return result
}
