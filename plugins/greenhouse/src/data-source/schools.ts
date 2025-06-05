import type { Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", slugifiable: true }
const textField: Field = { id: "text", name: "Text", type: "string", slugifiable: true }

const fields: Field[] = [idField, textField]

const SchoolsDataSource: GreenhouseDataSource = {
    id: "schools",
    name: "Schools",
    apiEndpoint: "education/schools",
    itemsKey: "items",
    fields,
    idField: idField,
    slugField: textField,
}

export default SchoolsDataSource
