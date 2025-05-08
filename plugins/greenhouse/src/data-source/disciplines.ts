import type { Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "id", type: "string" }
const textField: Field = { id: "text", name: "Text", type: "string" }

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
