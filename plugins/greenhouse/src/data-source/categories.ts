import type { DataSource, Field } from "./types"

const idField: Field = { id: "id", name: "Id", type: "string" }
const titleField: Field = { id: "title", name: "Title", type: "string" }
const descriptionField: Field = { id: "description", name: "Description", type: "string" }
const colorField: Field = { id: "color", name: "Color", type: "color" }

const fields: Field[] = [idField, titleField, descriptionField, colorField]

const CategoryDataSource: DataSource = {
    id: "categories",
    fields,
    idField: idField,
    slugField: titleField,
}

export default CategoryDataSource
