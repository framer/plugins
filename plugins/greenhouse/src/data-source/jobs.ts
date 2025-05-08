// import CategoryDataSource from "./categories"
import type { DataSource, Field } from "./types"

const internalIdField: Field = { id: "internal_job_id", name: "Internal Job ID", type: "string" }
const idField: Field = { id: "id", name: "id", type: "string" }
const titleField: Field = { id: "title", name: "Title", type: "string" }
const updatedAtField: Field = { id: "updated_at", name: "Updated At", type: "date" }
const requisitionIdField: Field = {
    id: "requisition_id",
    name: "Requisition ID",
    type: "string",
}
const locationField: Field = {
    id: "location",
    name: "Location",
    type: "string",
    map: (value: { name: string }) => value?.name,
}

const absoluteUrlField: Field = {
    id: "absolute_url",
    name: "Absolute URL",
    type: "link",
}

const companyNameField: Field = {
    id: "company_name",
    name: "Company Name",
    type: "string",
}

const firstPublishedField: Field = {
    id: "first_published",
    name: "First Published",
    type: "date",
}

// const officesField: Field = {
//     id: "offices",
//     name: "Offices",
//     type: "multiCollectionReference",
// }

// const departmentsField: Field = {
//     id: "departments",
//     name: "Departments",
//     type: "multiCollectionReference",
// }

const fields: Field[] = [idField, titleField, contentField, readingTimeField, featuredField, categoriesField]

const JobsDataSource: DataSource = {
    id: "jobs",
    name: "Jobs",
    apiEndpoint: "jobs?content=true",
    itemsKey: "jobs",
    fields,
    idField: idField,
    slugField: titleField,
}

export default JobsDataSource
