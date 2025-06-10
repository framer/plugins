import { useMutation } from "@tanstack/react-query"
import { type ManagedCollectionField, framer, ManagedCollection, } from "framer-plugin"
import { BlogPost, fetchAllBlogPosts } from "./api"
import {
    type FieldsById,
    type SyncResult,
    type SyncStatus,
    computeFieldSets,
    createFieldSetHash,
    logSyncResult,
    MAX_CMS_ITEMS,
} from "./cms"
import { HUBSPOT_BLOG_FIELDS } from "./constants"
import { assert, isDefined } from "./utils"

export const PLUGIN_INCLUDED_FIELDS_HASH = "hubspotPluginBlogIncludedFieldsHash"

export interface SyncBlogMutation {
    fields: ManagedCollectionField[]
    includedFieldIds: string[]
}

export interface ProcessBlogParams {
    fields: ManagedCollectionField[]
    fieldsById: FieldsById
    unsyncedItemIds: Set<string>
}

export interface ProcessPostParams extends ProcessBlogParams {
    post: BlogPost
    status: SyncStatus
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
    hasChangedFields: boolean
}

export type BlogPluginContext = BlogPluginContextNew | BlogPluginContextUpdate

export function shouldSyncBlogImmediately(pluginContext: BlogPluginContext): pluginContext is BlogPluginContextUpdate {
    if (pluginContext.type !== "update") return false
    if (pluginContext.hasChangedFields) return false

    return true
}

export async function getBlogPluginContext(): Promise<BlogPluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()
    const allPossibleFieldIds = HUBSPOT_BLOG_FIELDS.map(field => field.id)
    const rawIncludedFieldHash = await collection.getPluginData(PLUGIN_INCLUDED_FIELDS_HASH)

    if (!rawIncludedFieldHash) {
        return {
            type: "new",
            collection,
        }
    }

    const { includedFieldIds, hasHashChanged } = computeFieldSets({
        currentFields: collectionFields,
        allPossibleFieldIds,
        storedHash: rawIncludedFieldHash,
    })

    return {
        type: "update",
        collection,
        collectionFields,
        includedFieldIds,
        hasChangedFields: hasHashChanged,
    }
}

// eslint-disable-next-line
function isBlogPropertyValueMissing(value: any): boolean {
    // Empty array
    if (Array.isArray(value)) {
        return value.length === 0
    }

    // No keys
    if (typeof value === "object") {
        return Object.keys(value).length === 0
    }

    // For all other types
    return value === null || value === undefined || value === ""
}

function processPost({ post, fieldsById, unsyncedItemIds, status }: ProcessPostParams) {
    let slugValue: string | null = null
    const fieldData: Record<string, unknown> = {}

    unsyncedItemIds.delete(post.id)

    for (const [propertyName, propertyValue] of Object.entries(post)) {
        if (propertyName === "slug") {
            assert(typeof propertyValue === "string", "Expected 'slug' to be a string")

            slugValue = propertyValue
        }

        const field = fieldsById.get(propertyName)

        // Not included in field mapping, skip
        if (!field) continue

        if (isBlogPropertyValueMissing(propertyValue)) {
            status.warnings.push({
                fieldName: propertyName,
                message: `Value is missing for field ${field.name}`,
            })
        }

        fieldData[propertyName] = propertyValue
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

function processBlog(posts: BlogPost[], processBlogParams: ProcessBlogParams) {
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

export async function syncBlogs({ fields, includedFieldIds }: SyncBlogMutation) {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map(fields.map(field => [field.id, field]))
    const unsyncedItemIds = new Set(await collection.getItemIds())

    // Always include the blog Id and slug
    const { results: posts } = await fetchAllBlogPosts(
        MAX_CMS_ITEMS,
        Array.from(new Set([...includedFieldIds, "id", "slug"]))
    )
    const { collectionItems, status } = processBlog(posts, {
        fields,
        fieldsById,
        unsyncedItemIds,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await collection.setPluginData(PLUGIN_INCLUDED_FIELDS_HASH, createFieldSetHash(includedFieldIds))

    const result: SyncResult = {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }

    logSyncResult(result, collectionItems)

    return result
}

export const useSyncBlogsMutation = ({
    onSuccess,
    onError,
}: {
    onSuccess?: (result: SyncResult) => void
    onError?: (e: Error) => void
}) => {
    return useMutation({
        mutationFn: (args: SyncBlogMutation) => syncBlogs(args),
        onSuccess,
        onError,
    })
}
