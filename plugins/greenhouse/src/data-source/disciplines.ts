import type { Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", slugifiable: true }
const textField: Field = { id: "text", name: "Text", type: "string", slugifiable: true }

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
