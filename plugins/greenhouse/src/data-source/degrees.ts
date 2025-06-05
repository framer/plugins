import type { Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", slugifiable: true }
const textField: Field = { id: "text", name: "Text", type: "string", slugifiable: true }

const fields: Field[] = [idField, textField]

const DegreesDataSource: GreenhouseDataSource = {
    id: "degrees",
    name: "Degrees",
    apiEndpoint: "education/degrees",
    itemsKey: "items",
    fields,
    idField: idField,
    slugField: textField,
}

export default DegreesDataSource
