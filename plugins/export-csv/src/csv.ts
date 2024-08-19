import type { Collection, CollectionField, CollectionItem } from "framer-plugin"

import { isFileAsset, isImageAsset } from "framer-plugin"
import { assertNever } from "./assert"

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

export function getDataForCSV(fields: CollectionField[], items: CollectionItem[]): Rows {
    const rows: Rows = []

    // Add header row.
    rows.push(fields.map(field => field.name))

    // Add slug header to the start.
    rows[0].unshift("slug")

    // Add all the data rows.
    for (const item of items) {
        const columns: Columns = []

        // Add the slug cell.
        columns.push(item.slug)

        for (const field of fields) {
            const value = item.fieldData[field.id]

            switch (field.type) {
                case "image":
                case "file": {
                    if (!isImageAsset(value) && !isFileAsset(value)) {
                        columns.push("")
                        continue
                    }

                    columns.push(`${value.url}`)
                    continue
                }

                case "formattedText": {
                    if (typeof value !== "string") {
                        columns.push("")
                        continue
                    }

                    columns.push(`${value}`)
                    continue
                }

                case "enum": {
                    if (!value) {
                        columns.push(field.cases[0].name)
                        continue
                    }

                    columns.push(`${value}`)
                    continue
                }

                case "string":
                case "boolean":
                case "color":
                case "date":
                case "link":
                case "number":
                    columns.push(`${value}`)
                    continue

                case "unsupported":
                    columns.push("")
                    continue

                default:
                    assertNever(field)
            }
        }

        rows.push(columns)
    }

    return rows
}

export async function exportCollectionAsCSV(collection: Collection, filename: string) {
    const fields = await collection.getFields()
    const items = await collection.getItems()

    const rows = getDataForCSV(fields, items)

    const csv = rows
        .map(row => {
            return row
                .map(column => {
                    return `"${escapeCell(column)}"`
                })
                .join(", ")
        })
        .join("\n")

    const file = new File([csv], `${filename}.csv`, {
        type: "text/csv",
    })

    downloadFile(file)
}
