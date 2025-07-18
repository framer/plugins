import type { BlogPost } from "@hubspot/api-client/lib/codegen/cms/blogs/blog_posts/models/BlogPost"
import { useMutation } from "@tanstack/react-query"
import {
    type FieldDataEntryInput,
    type FieldDataInput,
    framer,
    ManagedCollection,
    type ManagedCollectionFieldInput,
} from "framer-plugin"
import { fetchAllBlogPosts } from "./api"
import {
    computeFieldSets,
    createFieldSetHash,
    type FieldsById,
    logSyncResult,
    MAX_CMS_ITEMS,
    type SyncResult,
    type SyncStatus,
} from "./cms"
import { HUBSPOT_BLOG_FIELDS } from "./constants"
import { assert, isDefined } from "./utils"

export const PLUGIN_INCLUDED_FIELDS_HASH = "hubspotPluginBlogIncludedFieldsHash"

export interface SyncBlogMutation {
    fields: ManagedCollectionFieldInput[]
    includedFieldIds: string[]
}

export interface ProcessBlogParams {
    fields: ManagedCollectionFieldInput[]
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
    collectionFields: ManagedCollectionFieldInput[]
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
    const collection = await framer.getActiveManagedCollection()
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

function getFieldDataEntryInput(field: ManagedCollectionFieldInput, value: unknown): FieldDataEntryInput | undefined {
    switch (field.type) {
        case "string": {
            if (typeof value !== "string") return undefined
            return { type: "string", value }
        }

        case "number": {
            if (typeof value !== "number") return undefined
            return { type: "number", value }
        }

        case "date": {
            if (typeof value !== "number") return undefined
            return { type: "date", value: new Date(value).toUTCString() }
        }

        case "boolean": {
            if (typeof value !== "boolean") return undefined
            return { type: "boolean", value }
        }

        case "enum": {
            if (typeof value !== "string") return undefined
            return { type: "enum", value }
        }

        case "image": {
            if (typeof value !== "string") return undefined
            return { type: "image", value }
        }

        case "file": {
            if (typeof value !== "string") return undefined
            return { type: "file", value }
        }

        case "color": {
            if (typeof value !== "string") return undefined
            return { type: "color", value }
        }

        case "formattedText": {
            if (typeof value !== "string") return undefined
            return { type: "formattedText", value }
        }

        case "link": {
            if (typeof value !== "string") return undefined
            return { type: "link", value }
        }

        case "collectionReference":
        case "multiCollectionReference":
        case "array": {
            // TODO: Implement
            return undefined
        }

        default: {
            field satisfies never
        }
    }
}

function processPost({ post, fieldsById, unsyncedItemIds, status }: ProcessPostParams) {
    let slugValue: string | null = null
    const fieldData: FieldDataInput = {}

    unsyncedItemIds.delete(post.id)

    for (const [propertyName, propertyValue] of Object.entries(post) as [string, unknown][]) {
        if (propertyName === "slug") {
            assert(typeof propertyValue === "string", "Expected 'slug' to be a string")

            slugValue = propertyValue
        }

        const field = fieldsById.get(propertyName)

        // Not included in field mapping, skip
        if (!field) continue

        const fieldDataEntryInput = getFieldDataEntryInput(field, propertyValue)
        if (fieldDataEntryInput) {
            fieldData[propertyName] = fieldDataEntryInput
        } else {
            status.warnings.push({
                fieldName: propertyName,
                message: `Value is missing for field ${field.name}`,
            })
        }
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
    const collection = await framer.getActiveManagedCollection()

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
        mutationFn: async (args: SyncBlogMutation) => {
            const collection = await framer.getActiveManagedCollection()
            await collection.setFields(args.fields)
            return await syncBlogs(args)
        },
        onSuccess,
        onError,
    })
}
