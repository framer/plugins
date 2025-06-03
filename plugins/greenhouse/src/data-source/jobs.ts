// import CategoryDataSource from "./categories"
import DepartmentsDataSource from "./departments"
import OfficesDataSource from "./offices"
import type { CollectionReferenceField, Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", slugifiable: true }
const internalIdField: Field = { id: "internal_job_id", name: "Internal Job ID", type: "string" }
const titleField: Field = { id: "title", name: "Title", type: "string", slugifiable: true }
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

const officesField: CollectionReferenceField = {
    id: "offices",
    name: "Offices",
    type: "multiCollectionReference",
    getCollection: () => OfficesDataSource,
    map: (offices: { id: number }[]) => offices.map(office => String(office.id)),
}

const departmentsField: CollectionReferenceField = {
    id: "departments",
    name: "Departments",
    type: "multiCollectionReference",
    getCollection: () => DepartmentsDataSource,
    map: (departments: { id: number }[]) => departments.map(department => String(department.id)),
}

const contentField: Field = {
    id: "content",
    name: "Content",
    type: "formattedText",
}

const fields: Field[] = [
    internalIdField,
    idField,
    titleField,
    updatedAtField,
    requisitionIdField,
    locationField,
    absoluteUrlField,
    companyNameField,
    firstPublishedField,
    officesField,
    departmentsField,
    contentField,
]

const JobsDataSource: GreenhouseDataSource = {
    id: "jobs",
    name: "Jobs",
    apiEndpoint: "jobs?content=true",
    itemsKey: "jobs",
    fields,
    idField: idField,
    slugField: titleField,
}

export default JobsDataSource
