import { departmentsDataSource } from "./departments"
import { officesDataSource } from "./offices"
import type { GreenhouseDataSource, GreenhouseField } from "./types"

const idField = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const internalIdField = { id: "internal_job_id", name: "Internal Job ID", type: "string" } satisfies GreenhouseField
const titleField = { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const updatedAtField = { id: "updated_at", name: "Updated At", type: "date" } satisfies GreenhouseField

const requisitionIdField = {
    id: "requisition_id",
    name: "Requisition ID",
    type: "string",
} satisfies GreenhouseField

const locationField = {
    id: "location",
    name: "Location",
    type: "string",
    getValue: value => {
        if (typeof value === "object" && value !== null && "name" in value) {
            return value.name
        }

        return null
    },
} satisfies GreenhouseField

const absoluteUrlField = {
    id: "absolute_url",
    name: "Absolute URL",
    type: "link",
} satisfies GreenhouseField

const companyNameField = {
    id: "company_name",
    name: "Company Name",
    type: "string",
} satisfies GreenhouseField

const firstPublishedField = {
    id: "first_published",
    name: "First Published",
    type: "date",
} satisfies GreenhouseField

const officesField = {
    id: "offices",
    name: "Offices",
    type: "multiCollectionReference",
    collectionId: "",
    getCollectionId: () => officesDataSource.id,
    getValue: offices => {
        if (Array.isArray(offices)) {
            return offices.map(office => String(office.id))
        }

        return []
    },
} satisfies GreenhouseField

const departmentsField = {
    id: "departments",
    name: "Departments",
    type: "multiCollectionReference",
    collectionId: "",
    getCollectionId: () => departmentsDataSource.id,
    getValue: departments => {
        if (Array.isArray(departments)) {
            return departments.map(department => String(department.id))
        }

        return []
    },
} satisfies GreenhouseField

const contentField = {
    id: "content",
    name: "Content",
    type: "formattedText",
} satisfies GreenhouseField

export const jobsDataSource: GreenhouseDataSource = {
    id: "jobs",
    name: "Jobs",
    apiEndpoint: "jobs?content=true",
    itemsKey: "jobs",
    fields: [
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
    ],
    idField: idField.id,
    slugField: titleField.id,
} satisfies GreenhouseDataSource
