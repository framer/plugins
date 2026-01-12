import type { Collection, CreateField, Field } from "framer-plugin"
import type { FieldMappingItem } from "../components/FieldMapperRow"
import type { MissingFieldItem } from "../routes/FieldMapper"
import type { VirtualFieldType } from "./virtualTypes"

export async function removeFieldsFromCms(collection: Collection, missingFields: MissingFieldItem[]): Promise<void> {
    const fieldsToRemove = missingFields.filter(m => m.action === "remove").map(m => m.field.id)
    if (fieldsToRemove.length > 0) {
        await collection.removeFields(fieldsToRemove)
    }
}

export async function createNewFieldsInCms(collection: Collection, mappings: FieldMappingItem[]): Promise<void> {
    const fieldsToAdd: CreateField[] = mappings
        .filter(mapping => mapping.action === "create")
        .map(mapping => {
            // Use overrideType if user changed the type, otherwise use the inferred type
            const fieldType = mapping.overrideType ?? mapping.inferredField.inferredType
            return createFieldConfig(fieldType, mapping.inferredField.name)
        })
        .filter((fieldConfig): fieldConfig is CreateField => fieldConfig !== null)

    if (fieldsToAdd.length > 0) {
        await collection.addFields(fieldsToAdd)
    }
}

/**
 * Create a field configuration object for adding a new field
 */
function createFieldConfig(type: VirtualFieldType, name: string): CreateField | null {
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
            return { type: "date", name, displayTime: false }

        case "datetime":
            return { type: "date", name, displayTime: true }

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
    mappings: FieldMappingItem[]
    collectionFields: Field[]
}

/**
 * Get the mapped field name for a CSV column based on mappings
 */
export function getMappedFieldName(opts: GetMappedFieldNameOpts): string | null {
    const mapping = opts.mappings.find(m => m.inferredField.columnName === opts.csvColumnName)

    if (!mapping || mapping.action === "ignore") {
        return null
    }

    // If it's mapped to an existing field, return that field's name
    if (mapping.action === "map" && mapping.targetFieldId) {
        const mappedField = opts.collectionFields.find(f => f.id === mapping.targetFieldId)
        return mappedField?.name ?? null
    }

    // If it's a new field, return the inferred field name
    return mapping.inferredField.name
}
