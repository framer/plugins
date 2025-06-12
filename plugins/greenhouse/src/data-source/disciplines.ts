import type { Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const textField: Field = { id: "text", name: "Text", type: "string", canBeUsedAsSlug: true }

const fields: Field[] = [idField, textField]

const DisciplinesDataSource: GreenhouseDataSource = {
    id: "disciplines",
    name: "Disciplines",
    apiEndpoint: "education/disciplines",
    itemsKey: "items",
    fields,
    idField: idField,
    slugField: textField,
}

export default DisciplinesDataSource
