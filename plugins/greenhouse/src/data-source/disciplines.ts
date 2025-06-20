import type { GreenhouseDataSource, GreenhouseField } from "./types"

const idField = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const textField = { id: "text", name: "Text", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField

export const disciplinesDataSource = {
    id: "disciplines",
    name: "Disciplines",
    apiEndpoint: "education/disciplines",
    itemsKey: "items",
    fields: [idField, textField],
    idField: idField.id,
    slugField: textField.id,
} satisfies GreenhouseDataSource
