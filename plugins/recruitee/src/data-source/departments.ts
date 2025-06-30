// import CategoryDataSource from "./categories"

import type { CollectionReferenceField, Field, RecruiteeDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const nameField: Field = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true }
const updatedAtField: Field = { id: "updated_at", name: "Updated At", type: "date" }
const fields: Field[] = [
    idField,
    nameField,
    updatedAtField
]

const DepartmentsDataSource: RecruiteeDataSource = {
    id: "departments",
    name: "Departments",
    apiEndpoint: "departments?content=true",
    itemsKey: "departments",
    fields,
    idField: idField,
    slugField: nameField,
}
export default DepartmentsDataSource
