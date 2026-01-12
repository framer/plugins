import type { Field } from "framer-plugin"

const VALID_COLLECTION_REFERENCE_SLUGS: Field["type"][] = ["string", "number"]

/**
 * Check if a CSV column's inferred type can be imported into a target field type.
 * Some field types are more general and can accept values from other types.
 *
 * - Plain Text & Formatted Text: accept anything (most general)
 * - Link: accepts link, string
 * - Image: accepts image, link, string
 * - File: accepts file, image, link, string
 * - Number, Boolean, Date, Color: only accept their own type
 */
export function isTypeCompatible(sourceType: Field["type"], targetType: Field["type"]): boolean {
    // Same type is always compatible
    if (sourceType === targetType) {
        return true
    }

    // For collection references we allow any primitive type to be mapped (IDs are strings)
    if (targetType === "collectionReference" || targetType === "multiCollectionReference") {
        return VALID_COLLECTION_REFERENCE_SLUGS.includes(sourceType)
    }

    // Plain Text and Formatted Text can accept anything
    if (targetType === "string" || targetType === "formattedText") {
        return true
    }

    // Link can accept strings (URLs are detected as strings sometimes)
    if (targetType === "link" && sourceType === "string") {
        return true
    }

    // Image can accept link or string
    if (targetType === "image" && (sourceType === "link" || sourceType === "string")) {
        return true
    }

    // File can accept image, link, or string
    if (targetType === "file" && (sourceType === "image" || sourceType === "link" || sourceType === "string")) {
        return true
    }

    // Enum can accept strings
    if (targetType === "enum" && sourceType === "string") {
        return true
    }

    // Strict types: number, boolean, date, color only accept their own type
    return false
}
