import type { Collection, CreateField, Field } from "framer-plugin"
import type { InferredField } from "./typeInference"

export type FieldAction = "add" | "update" | "keep" | "remove" | "map"

export interface FieldReconciliationItem {
    inferredField?: InferredField
    existingField?: Field
    action: FieldAction
    /** For mapping: which existing field this CSV column should map to */
    mapToFieldId?: string
}

/**
 * Apply field reconciliation changes to a collection
 * This includes adding new fields, removing fields, and updating field types
 */
export async function reconcileFields(
    collection: Collection,
    reconciliation: FieldReconciliationItem[]
): Promise<void> {
    // Collect fields to add
    const fieldsToAdd: CreateField[] = []
    for (const item of reconciliation) {
        if (item.action === "add" && item.inferredField) {
            const { inferredField } = item
            const fieldConfig = createFieldConfig(inferredField.inferredType, inferredField.name)
            if (fieldConfig) {
                fieldsToAdd.push(fieldConfig)
            }
        }
    }

    // Add new fields using collection.addFields()
    if (fieldsToAdd.length > 0) {
        await collection.addFields(fieldsToAdd)
    }

    // Update field types
    for (const item of reconciliation) {
        if (item.action === "update" && item.existingField && item.inferredField) {
            const { existingField, inferredField } = item

            // Get the field object to update
            const fields = await collection.getFields()
            const field = fields.find(f => f.id === existingField.id)

            if (field) {
                // Update the field type using setAttributes
                const updateConfig = createFieldUpdateConfig(inferredField.inferredType, field.name)
                if (updateConfig) {
                    await field.setAttributes(updateConfig)
                }
            }
        }
    }

    // Collect fields to remove
    const fieldsToRemove = reconciliation
        .filter(item => item.action === "remove" && item.existingField)
        .map(item => item.existingField!.id)

    // Remove fields using collection.removeFields()
    if (fieldsToRemove.length > 0) {
        await collection.removeFields(fieldsToRemove)
    }

    // Note: "map" actions don't require field changes - they're handled during import
    // Note: "keep" actions don't require any changes
}

/**
 * Create a field update configuration for changing an existing field's type
 */
function createFieldUpdateConfig(type: Field["type"], name: string): Partial<Field> | null {
    switch (type) {
        case "string":
            return { type: "string", name }

        case "formattedText":
            return { type: "formattedText", name }

        case "number":
            return { type: "number", name }

        case "boolean":
            return { type: "boolean", name }

        case "date":
            return { type: "date", name }

        case "color":
            return { type: "color", name }

        case "link":
            return { type: "link", name }

        case "file":
            return { type: "file", name }

        case "image":
            return { type: "image", name }

        case "enum":
            // For enum fields, we need to provide at least one case
            // Note: This may not work well for updates, as it could lose existing cases
            return null

        case "collectionReference":
        case "multiCollectionReference":
        case "array":
        case "divider":
        case "unsupported":
            // These types aren't supported for updates
            return null

        default:
            return null
    }
}

/**
 * Create a field configuration object for adding a new field
 */
function createFieldConfig(type: Field["type"], name: string): CreateField | null {
    switch (type) {
        case "string":
            return { type: "string", name }

        case "formattedText":
            return { type: "formattedText", name }

        case "number":
            return { type: "number", name }

        case "boolean":
            return { type: "boolean", name }

        case "date":
            return { type: "date", name }

        case "color":
            return { type: "color", name }

        case "link":
            return { type: "link", name }

        case "file":
            return { type: "file", name, allowedFileTypes: [] }

        case "image":
            return { type: "image", name }

        case "enum":
            // For enum fields, we need to provide at least one case
            return {
                type: "enum",
                name,
                cases: [{ name: "Default" }],
            }

        case "collectionReference":
        case "multiCollectionReference":
        case "array":
        case "divider":
        case "unsupported":
            // These types either require additional configuration we don't have,
            // or aren't supported for CSV import. Return null to skip.
            return null

        default:
            return null
    }
}

export interface GetMappedFieldNameOpts {
    csvColumnName: string
    reconciliation: FieldReconciliationItem[]
    collectionFields: Field[]
}

/**
 * Get the mapped field name for a CSV column based on reconciliation
 */
export function getMappedFieldName(opts: GetMappedFieldNameOpts): string | null {
    const item = opts.reconciliation.find(r => r.inferredField?.columnName === opts.csvColumnName)

    if (!item) {
        return null
    }

    // If it's mapped to an existing field, return that field's name
    if (item.action === "map" && item.mapToFieldId) {
        const mappedField = opts.collectionFields.find(f => f.id === item.mapToFieldId)
        return mappedField?.name ?? null
    }

    // If it's a new field or keeping existing, return the inferred field name
    if (item.inferredField) {
        return item.inferredField.name
    }

    return null
}
