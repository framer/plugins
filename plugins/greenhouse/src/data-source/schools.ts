import type { GreenhouseDataSource, GreenhouseField } from "./types"

const idField = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const textField = { id: "text", name: "Text", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField

export const schoolsDataSource = {
    id: "schools",
    name: "Schools",
    apiEndpoint: "education/schools",
    itemsKey: "items",
    fields: [idField, textField],
    idField: idField.id,
    slugField: textField.id,
} satisfies GreenhouseDataSource
