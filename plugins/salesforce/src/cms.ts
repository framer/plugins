import { framer, ManagedCollection, ManagedCollectionField } from "framer-plugin"
import { computeFieldSets, createFieldSetHash, isDefined, slugify } from "./utils"
import {
    fetchObjectConfig,
    fetchObjectRecords,
    fetchObjectFieldId,
    SFFieldConfig,
    SFRecord,
    SFRecordFieldValue,
} from "./api"
import { logSyncResult } from "./debug"
import { useMutation } from "@tanstack/react-query"

interface ItemResult {
    fieldName?: string
    message: string
}

interface SyncStatus {
    errors: ItemResult[]
    warnings: ItemResult[]
    info: ItemResult[]
}

const PLUGIN_OBJECT_ID_KEY = "salesforcePluginObjectId"
const PLUGIN_OBJECT_LABEL_KEY = "salesforcePluginObjectLabel"
const PLUGIN_INCLUDED_FIELD_HASH_KEY = "salesforcePluginIncludedFieldHash"
const PLUGIN_LAST_SYNCED_KEY = "salesforcePluginLastSynced"
const PLUGIN_SLUG_ID_KEY = "salesforcePluginSlugId"

const EXCLUDED_FIELD_IDS = ["attributes", "Id"]
const MAX_CMS_ITEMS = 10_000

/**
 * Get the value of a Salesforce object field in a format compatible with a collection field
 */
function getObjectFieldValue(fieldConfig: SFFieldConfig, fieldValue: SFRecordFieldValue): unknown | null {
    switch (fieldConfig.type) {
        case "textarea":
        case "richtext":
        case "id":
        case "url":
        case "picklist":
        case "phone":
        case "email":
        case "base64":
            return typeof fieldValue === "string" ? fieldValue : null

        case "currency":
        case "double":
        case "int":
        case "long":
            return typeof fieldValue === "number" ? fieldValue : null

        case "date":
        case "datetime":
            return typeof fieldValue === "string" ? new Date(fieldValue).toISOString() : fieldValue

        case "reference":
            // fieldValue is the Id of the foreign object
            return typeof fieldValue === "string" ? fieldValue : null

        default:
            return fieldValue
    }
}

/**
 * Get the collection field schema for a Salesforce field
 * Returns `null` for fields that are supported but can't be synced yet
 * Returns `undefined` for fields that are not supported outright
 */
export function getCollectionFieldForSalesforceField(
    fieldConfig: SFFieldConfig,
    objectIdMap: ObjectIdMap
): ManagedCollectionField | null | undefined {
    const fieldMetadata = {
        id: fieldConfig.name,
        name: fieldConfig.label,
        userEditable: false,
    }

    switch (fieldConfig.type) {
        case "id":
        case "string":
        case "email":
        case "phone":
            return { ...fieldMetadata, type: "string" }

        case "boolean":
            return { ...fieldMetadata, type: "boolean" }

        case "currency":
        case "double":
        case "int":
        case "long":
            return { ...fieldMetadata, type: "number" }

        case "date":
        case "datetime":
            return { ...fieldMetadata, type: "date" }

        case "picklist": {
            return {
                ...fieldMetadata,
                type: "enum",
                cases:
                    fieldConfig.picklistValues?.map(picklistValue => ({
                        id: picklistValue.value,
                        name: picklistValue.label,
                    })) || [],
            }
        }

        case "url":
            return { ...fieldMetadata, type: "link" }

        case "textarea":
        case "richtext":
            return { ...fieldMetadata, type: "formattedText" }

        case "base64":
            return { ...fieldMetadata, type: "file", allowedFileTypes: [] }

        case "reference": {
            // Objects can relate to multiple fields as one field e.g.
            // ["Lead", "Contact"]
            let refCollectionId: string | null = null
            for (const objectId of fieldConfig.referenceTo) {
                const collectionId = objectIdMap.get(objectId)

                // Relation does not exist, check the next possible
                // reference
                if (!collectionId) continue

                refCollectionId = collectionId
            }

            // Object includes a relation to an object that hasn't been synced
            // to Framer
            if (!refCollectionId) {
                return null
            }

            return {
                ...fieldMetadata,
                type: "collectionReference",
                collectionId: refCollectionId,
            }
        }

        default:
            return undefined
    }
}

export type ObjectIdMap = Map<string, string>

type FieldsById = Map<string, ManagedCollectionField>

interface ProcessAllRecordsParams {
    fields: ManagedCollectionField[]
    fieldConfigs: SFFieldConfig[]
    fieldsById: FieldsById
    slugFieldId: string
    unsyncedItemIds: Set<string>
    objectName: string // Added this parameter
}

interface ProcessRecordParams extends ProcessAllRecordsParams {
    record: SFRecord
    status: SyncStatus
}

export interface SyncProgress {
    totalCount: number
    completedCount: number
    completedPercent: number
}

type OnProgressHandler = (progress: SyncProgress) => void

async function processRecord({
    record,
    fieldConfigs,
    slugFieldId,
    fieldsById,
    status,
    unsyncedItemIds,
    objectName,
}: ProcessRecordParams) {
    let slugValue: string | null = null
    const fieldData: Record<string, unknown> = {}

    if (typeof record.Id !== "string") {
        throw new Error("Expected record.id to be of type string")
    }

    unsyncedItemIds.delete(record.Id)

    for (const [fieldId, fieldValue] of Object.entries(record)) {
        const fieldConfig = fieldConfigs.find(config => config.name === fieldId)

        if (!fieldConfig) continue

        const collectionFieldValue = getObjectFieldValue(fieldConfig, fieldValue)

        if (fieldId === slugFieldId) {
            if (typeof fieldValue !== "string") continue
            slugValue = slugify(fieldValue)
        }

        // These fields are included in the request regardless of the requested properties
        if (EXCLUDED_FIELD_IDS.includes(fieldId)) {
            continue
        }

        const field = fieldsById.get(fieldId)

        // Not included in the field mapping, skip
        if (!field) continue

        if (!fieldValue) {
            status.warnings.push({
                fieldName: fieldId,
                message: `Value is missing for field ${field.name}`,
            })
        }

        // If it's a custom field, we need to fetch its Id since custom fields have mutable names
        if (fieldConfig.custom) {
            try {
                const fieldId = await fetchObjectFieldId(objectName, fieldConfig.name)
                fieldData[fieldId] = collectionFieldValue
            } catch (e) {
                status.errors.push({
                    fieldName: fieldConfig.name,
                    message: `Failed to fetch ID for custom field: ${e instanceof Error ? e.message : String(e)}. Field will be excluded.`,
                })

                continue
            }
        } else {
            fieldData[fieldConfig.name] = collectionFieldValue
        }
    }

    if (!slugValue) {
        status.warnings.push({
            message: "Slug missing. Skipping item.",
        })
        return null
    }

    return {
        id: record.Id,
        slug: slugValue,
        fieldData,
    }
}

async function processAllRecords(
    records: SFRecord[],
    onProgress: OnProgressHandler,
    processRecordParams: ProcessAllRecordsParams
) {
    const seenItemIds = new Set<string>()
    const status: SyncStatus = {
        info: [],
        warnings: [],
        errors: [],
    }

    const totalCount = records.length
    let completedCount = 0

    onProgress({ totalCount, completedCount, completedPercent: 0 })

    const processedRecords = []
    for (const record of records) {
        const result = await processRecord({
            ...processRecordParams,
            record,
            status,
        })

        completedCount++
        onProgress({
            totalCount,
            completedCount,
            completedPercent: Math.round((completedCount / totalCount) * 100),
        })

        if (result) {
            processedRecords.push(result)
        }
    }

    return {
        collectionItems: processedRecords,
        status,
        seenItemIds,
    }
}

interface SyncMutationOptions {
    objectId: string
    objectLabel: string
    fields: ManagedCollectionField[]
    includedFieldIds: string[]
    slugFieldId: string
    fieldConfigs: SFFieldConfig[]
    onProgress: OnProgressHandler
}

export interface SyncResult extends SyncStatus {
    status: "success" | "completed_with_errors"
}

export async function syncAllRecords({
    objectId,
    objectLabel,
    fields,
    includedFieldIds,
    slugFieldId,
    fieldConfigs,
    onProgress,
}: SyncMutationOptions): Promise<SyncResult> {
    const collection = await framer.getManagedCollection()
    await collection.setFields(fields)

    const fieldsById = new Map(fields.map(field => [field.id, field]))
    const unsyncedItemIds = new Set(await collection.getItemIds())

    // Always include the slug field and Id
    const records = await fetchObjectRecords(
        objectId,
        Array.from(new Set([...includedFieldIds, slugFieldId, "Id"])),
        MAX_CMS_ITEMS
    )

    const { collectionItems, status } = await processAllRecords(records, onProgress, {
        fields,
        fieldConfigs,
        fieldsById,
        slugFieldId,
        unsyncedItemIds,
        objectName: objectId,
    })

    await collection.addItems(collectionItems)

    const itemsToDelete = Array.from(unsyncedItemIds)
    await collection.removeItems(itemsToDelete)

    await Promise.all([
        collection.setPluginData(PLUGIN_INCLUDED_FIELD_HASH_KEY, createFieldSetHash(includedFieldIds)),
        collection.setPluginData(PLUGIN_OBJECT_ID_KEY, objectId),
        collection.setPluginData(PLUGIN_OBJECT_LABEL_KEY, objectLabel),
        collection.setPluginData(PLUGIN_SLUG_ID_KEY, slugFieldId),
        collection.setPluginData(PLUGIN_LAST_SYNCED_KEY, new Date().toISOString()),
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

// Rest of the code remains the same...

export async function getObjectIdMap(): Promise<ObjectIdMap> {
    const objectIdMap: ObjectIdMap = new Map()

    for (const collection of await framer.getCollections()) {
        const collectionTableId = await collection.getPluginData(PLUGIN_OBJECT_ID_KEY)
        if (!collectionTableId) continue

        objectIdMap.set(collectionTableId, collection.id)
    }

    return objectIdMap
}

export function getPossibleSlugFields(fieldConfigs: SFFieldConfig[]) {
    const options: SFFieldConfig[] = []

    for (const fieldConfig of fieldConfigs) {
        switch (fieldConfig.type) {
            case "string":
                options.push(fieldConfig)
        }
    }

    return options
}

function hasFieldConfigurationChanged(
    currentManagedCollectionFields: ManagedCollectionField[],
    fields: SFFieldConfig[],
    includedFieldIds: string[],
    objectIdMap: ObjectIdMap
): boolean {
    const currentFieldsById = new Map(currentManagedCollectionFields.map(field => [field.id, field]))

    // Consider currently included fields only
    const includedObjectFields = fields.filter(field => includedFieldIds.includes(field.name))

    if (includedObjectFields.length !== currentManagedCollectionFields.length) {
        return true
    }

    for (const objectField of includedObjectFields) {
        const collectionField = currentFieldsById.get(objectField.name)
        const expectedField = getCollectionFieldForSalesforceField(objectField, objectIdMap)

        if (!collectionField) {
            return true
        }

        if (!expectedField || collectionField.type !== expectedField.type) {
            return true
        }
    }

    return false
}

export function shouldSyncImmediately(pluginContext: PluginContext): pluginContext is PluginContextUpdate {
    if (pluginContext.type !== "update") return false

    if (!pluginContext.slugFieldId) return false
    if (pluginContext.hasChangedFields) return false

    return true
}

export interface PluginContextNew {
    type: "new"
    collection: ManagedCollection
    objectIdMap: ObjectIdMap
}

export interface PluginContextUpdate {
    type: "update"
    objectId: string
    objectLabel: string
    fieldConfigs: SFFieldConfig[]
    collection: ManagedCollection
    collectionFields: ManagedCollectionField[]
    hasChangedFields: boolean
    includedFieldIds: string[]
    slugFieldId: string | null
    objectIdMap: ObjectIdMap
}

export type PluginContext = PluginContextNew | PluginContextUpdate

export async function getPluginContext(): Promise<PluginContext> {
    const collection = await framer.getManagedCollection()
    const collectionFields = await collection.getFields()

    const [objectId, objectLabel, slugFieldId, rawIncludedFieldsHash] = await Promise.all([
        collection.getPluginData(PLUGIN_OBJECT_ID_KEY),
        collection.getPluginData(PLUGIN_OBJECT_LABEL_KEY),
        collection.getPluginData(PLUGIN_SLUG_ID_KEY),
        collection.getPluginData(PLUGIN_INCLUDED_FIELD_HASH_KEY),
    ])

    const objectIdMap = await getObjectIdMap()

    if (!objectId || !objectLabel || !rawIncludedFieldsHash) {
        return {
            type: "new",
            collection,
            objectIdMap,
        }
    }

    const { fields } = await fetchObjectConfig(objectId)

    const { includedFieldIds, hasHashChanged } = computeFieldSets({
        currentFields: collectionFields,
        allPossibleFieldIds: fields.map(field => field.name).filter(isDefined),
        storedHash: rawIncludedFieldsHash,
    })

    let hasChangedFields: boolean
    // Skip doing full check since we already know it differs
    if (hasHashChanged) {
        hasChangedFields = true
    } else {
        // Do full check
        hasChangedFields = hasFieldConfigurationChanged(collectionFields, fields, includedFieldIds, objectIdMap)
    }

    return {
        type: "update",
        hasChangedFields,
        objectId,
        objectLabel,
        fieldConfigs: fields,
        collection,
        collectionFields,
        includedFieldIds,
        slugFieldId,
        objectIdMap,
    }
}

export const useSyncRecordsMutation = ({
    onSuccess,
    onError,
}: {
    onSuccess?: (result: SyncResult) => void
    onError?: (e: Error) => void
}) => {
    return useMutation({
        mutationFn: (args: SyncMutationOptions) => syncAllRecords(args),
        onSuccess,
        onError,
    })
}
