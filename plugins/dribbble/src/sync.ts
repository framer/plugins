import { framer, ManagedCollection, ManagedCollectionField } from "framer-plugin"
import { useMutation } from "@tanstack/react-query"
import { fetchAllShots, Shot } from "./api"
import { isDefined } from "./utils"
import { SHOT_FIELDS } from "./constants"
import {
    computeFieldSets,
    createFieldSetHash,
    FieldsById,
    logSyncResult,
    MAX_CMS_ITEMS,
    slugify,
    SyncResult,
    SyncStatus,
} from "./cms"
import auth from "./auth"

const PLUGIN_INCLUDED_FIELDS_HASH = "dribbblePluginShotIncludedFieldsHash"
const PLUGIN_SLUG_FIELD_ID_KEY = "dribbblePluginSlugFieldId"

export interface SyncShotsMutationOptions {
    fields: ManagedCollectionField[]
    includedFieldIds: string[]
    slugFieldId: string
}

export interface ProcessShotsParams {
    fields: ManagedCollectionField[]
    fieldsById: FieldsById
    slugFieldId: string
    unsyncedItemIds: Set<string>
}

export interface ProcessShotParams extends ProcessShotsParams {
    shot: Shot
    status: SyncStatus
}

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    isAuthenticated: boolean
}

export interface PluginContextUpdate {
    type: "update"
    collection: ManagedCollection
    collectionFields: ManagedCollectionField[]
    includedFieldIds: string[]
    slugFieldId: string
    isAuthenticated: boolean
}

export type PluginContext = PluginContextNew | PluginContextUpdate

export function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false

    return true
}

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()

    const isAuthenticated = auth.isAuthenticated()
    const allPossibleFieldIds = SHOT_FIELDS.map(field => field.id)

    const [slugFieldId, rawIncludedFieldHash] = await Promise.all([
        collection.getPluginData(PLUGIN_SLUG_FIELD_ID_KEY),
        collection.getPluginData(PLUGIN_INCLUDED_FIELDS_HASH),
    ])

    if (!rawIncludedFieldHash || !slugFieldId) {
        return {
            type: "new",
            collection,
            isAuthenticated,
        }
    }

    const { includedFieldIds } = computeFieldSets({
        currentFields: collectionFields,
        allPossibleFieldIds,
        storedHash: rawIncludedFieldHash,
    })

    return {
        type: "update",
        collection,
        collectionFields,
        includedFieldIds,
        isAuthenticated,
        slugFieldId,
    }
}

// eslint-disable-next-line
function isShotPropertyValueMissing(value: any): boolean {
    // Usual suspects
    if (value === null || value === undefined || value === "") {
        return true
    }

    // Empty array
    if (Array.isArray(value)) {
        return value.length === 0
    }

    // Empty object
    if (typeof value === "object") {
        return Object.keys(value).length === 0
    }

    return false
}

function processShot({ shot, slugFieldId, fieldsById, unsyncedItemIds, status }: ProcessShotParams) {
    let slugValue: string | null = null
    const fieldData: Record<string, unknown> = {}
    const fieldId = String(shot.id)
    unsyncedItemIds.delete(fieldId)

    for (const [propertyName, field] of fieldsById) {
        // Allow for nested dot notation to access fields e.g. images.hidpi
        let value: unknown
        if (propertyName.includes(".")) {
            value = propertyName.split(".").reduce((obj: unknown, key) => {
                if (obj && typeof obj === "object") {
                    return (obj as Record<string, unknown>)[key]
                }
                return undefined
            }, shot)
        } else {
            value = shot[propertyName as keyof Shot]
        }

        if (field.id === slugFieldId && typeof value === "string") {
            slugValue = slugify(value)
        }

        if (isShotPropertyValueMissing(value)) {
            status.warnings.push({
                fieldName: propertyName,
                message: `Value is missing for field ${field.name}`,
            })
        }

        fieldData[propertyName] = value
    }

    if (!slugValue) {
        status.warnings.push({ message: "Slug missing. Skipping item." })
        return null
    }

    return { id: fieldId, slug: slugValue, fieldData }
}

function processShots(shots: Shot[], processShotsParams: ProcessShotsParams) {
    const seenItemIds = new Set<string>()
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }

    const collectionItems = shots.map(shot => processShot({ shot, status, ...processShotsParams })).filter(isDefined)

    return {
        collectionItems,
        status,
        seenItemIds,
    }
}

export async function syncShots({ fields, slugFieldId, includedFieldIds }: SyncShotsMutationOptions) {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map(fields.map(field => [field.id, field]))
    const unsyncedItemIds = new Set(await collection.getItemIds())

    const allShots = await fetchAllShots(MAX_CMS_ITEMS)

    const { collectionItems, status } = processShots(allShots, {
        fields,
        fieldsById,
        unsyncedItemIds,
        slugFieldId,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await Promise.all([
        await collection.setPluginData(PLUGIN_INCLUDED_FIELDS_HASH, createFieldSetHash(includedFieldIds)),
        await collection.setPluginData(PLUGIN_SLUG_FIELD_ID_KEY, slugFieldId),
    ])

    const result: SyncResult = {
        status: status.errors.length === 0 ? "success" : "completed_with_errors",
        errors: status.errors,
        info: status.info,
        warnings: status.warnings,
    }

    logSyncResult(result, collectionItems)

    return result
}

export const useSyncShotsMutation = ({
    onSuccess,
    onError,
}: {
    onSuccess?: (result: SyncResult) => void
    onError?: (e: Error) => void
}) => {
    return useMutation({
        mutationFn: (args: SyncShotsMutationOptions) => syncShots(args),
        onSuccess,
        onError,
    })
}
