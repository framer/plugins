import type { Field } from "framer-plugin"

/**
 * Filters out field types that can't store data (dividers are visual separators, unsupported fields are not usable for
 * import).
 */
export function getDataFields(fields: Field[]): Field[] {
    return fields.filter(field => field.type !== "divider" && field.type !== "unsupported")
}
