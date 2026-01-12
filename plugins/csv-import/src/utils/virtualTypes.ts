import type { Field } from "framer-plugin"

/**
 * Virtual field type that extends the SDK Field type with "datetime"
 * This allows us to distinguish between date-only and date+time fields
 * while using the same underlying SDK date type with displayTime property
 */
export type VirtualFieldType = Field["type"] | "datetime"

/**
 * Convert SDK field to virtual type
 * For DateField, returns "datetime" if displayTime is true, otherwise "date"
 * For all other fields, returns the field type as-is
 */
export function sdkTypeToVirtual(field: Field): VirtualFieldType {
    if (field.type === "date") {
        const displayTime = "displayTime" in field ? field.displayTime : false
        return displayTime ? "datetime" : "date"
    }
    return field.type
}
