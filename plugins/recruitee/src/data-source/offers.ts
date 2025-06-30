// import CategoryDataSource from "./categories"

import type { CollectionReferenceField, Field, RecruiteeDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const titleField: Field = { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true }
const updatedAtField: Field = { id: "updated_at", name: "Updated At", type: "date" }
const locationField: Field = {
    id: "city",
    name: "City",
    type: "string"
}

const requirementsField: Field = {
    id: "requirements",
    name: "Requirements",
    type: "formattedText"
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


const contentField: Field = {
    id: "content",
    name: "Content",
    type: "formattedText",
}

const fields: Field[] = [
    idField,
    titleField,
    updatedAtField,
    locationField,
    requirementsField,
    companyNameField,
    firstPublishedField,
    contentField,
]

const OffersDataSource: RecruiteeDataSource = {
    id: "offers",
    name: "Offers",
    apiEndpoint: "offers?content=true",
    itemsKey: "offers",
    fields,
    idField: idField,
    slugField: titleField,
}
export default OffersDataSource
