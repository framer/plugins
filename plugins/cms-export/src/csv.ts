import type { Collection, CollectionItem, Field } from "framer-plugin"

import { isColorStyle } from "framer-plugin"

function downloadFile(file: File) {
    const filename = file.name
    const fileURL = URL.createObjectURL(file)

    const link = document.createElement("a")
    link.href = fileURL
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(fileURL)
}

type Columns = string[]
type Rows = Columns[]

/**
 * Escape quotes with another quote as per CSV standard.
 */
function escapeCell(value: string) {
    return value.replace(/"/gu, '""')
}

type SupportedField = Exclude<Field, { type: "divider" | "unsupported" }>

function isFieldSupported(field: Field): field is SupportedField {
    switch (field.type) {
        case "image":
        case "file":
        case "collectionReference":
        case "formattedText":
        case "multiCollectionReference":
        case "enum":
        case "color":
        case "string":
        case "boolean":
        case "date":
        case "link":
        case "number":
            return true

        case "divider":
        case "unsupported":
            return false

        default:
            field satisfies never
            return false
    }
}

export function getDataForCSV(slugFieldName: string | null, fields: Field[], items: CollectionItem[]): Rows {
    const rows: Rows = []
    const supportedFields = fields.filter(isFieldSupported)
    const hasDraftItems = items.some(item => item.draft)

    // Add header row with slug field at the start.
    const header: Columns = [slugFieldName ?? "Slug"]

    // Add draft column if there are any draft items.
    if (hasDraftItems) {
        header.push(":draft")
    }

    for (const field of supportedFields) {
        if (field.type === "image") {
            header.push(field.name, `${field.name}:alt`)
        } else {
            header.push(field.name)
        }
    }

    rows.push(header)

    // Add all the data rows.
    for (const item of items) {
        const columns: Columns = []

        // Add the slug cell.
        columns.push(item.slug)

        // Add draft column if there are any draft items.
        if (hasDraftItems) {
            columns.push(item.draft ? "true" : "false")
        }

        for (const field of supportedFields) {
            const fieldData = item.fieldData[field.id]

            if (!fieldData) {
                console.warn(`Field data not found for field ${field.name} in item ${item.slug}`)
                continue
            }

            switch (fieldData.type) {
                case "file": {
                    if (!fieldData.value) {
                        columns.push("")
                        continue
                    }

                    columns.push(fieldData.value.url)
                    continue
                }

                case "image": {
                    if (!fieldData.value) {
                        columns.push("", "")
                        continue
                    }

                    columns.push(fieldData.value.url, fieldData.value.altText ?? "")
                    continue
                }

                case "multiCollectionReference": {
                    columns.push(fieldData.value.join(","))
                    continue
                }

                case "enum": {
                    columns.push(fieldData.value)
                    continue
                }

                case "color": {
                    if (isColorStyle(fieldData.value)) {
                        columns.push(fieldData.value.light)
                        continue
                    }

                    columns.push(fieldData.value)
                    continue
                }

                case "collectionReference":
                case "formattedText":
                case "string":
                case "boolean":
                case "date":
                case "link":
                case "number": {
                    columns.push(fieldData.value === undefined ? "" : fieldData.value.toString())
                    continue
                }

                default: {
                    fieldData satisfies never
                }
            }
        }

        rows.push(columns)
    }

    return rows
}

export async function convertCollectionToCSV(collection: Collection) {
    const fields = await collection.getFields()
    const items = await collection.getItems()

    const rows = getDataForCSV(collection.slugFieldName, fields, items)

    const csv = rows
        .map(row => {
            return row
                .map(column => {
                    return `"${escapeCell(column)}"`
                })
                .join(",")
        })
        .join("\n")

    return csv
}

export async function exportCollectionAsCSV(collection: Collection, filename: string) {
    const csv = await convertCollectionToCSV(collection)

    const file = new File([csv], `${filename}.csv`, {
        type: "text/csv",
    })

    downloadFile(file)
}
