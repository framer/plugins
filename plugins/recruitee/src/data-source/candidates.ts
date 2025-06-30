import type { CollectionReferenceField, Field, RecruiteeDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const nameField: Field = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true }
const emailsField: Field = { id: "emails", name: "Email", type: "string", canBeUsedAsSlug: false }
const ratingField: Field = { id: "positive_ratings", name: "Rating", type: "number", canBeUsedAsSlug: false }
const isHiredField: Field = { id: "is_hired", name: "Is Hired?", type: "string", canBeUsedAsSlug: false }
const referrField: Field = { id: "referrer", name: "Referrer", type: "string", canBeUsedAsSlug: false }
const fields: Field[] = [
    idField,
    nameField,
    emailsField,
    referrField,
    ratingField,
    isHiredField
]

const CandidatesDataSource: RecruiteeDataSource = {
    id: "candidates",
    name: "Candidates",
    apiEndpoint: "candidates?content=true",
    itemsKey: "candidates",
    fields,
    idField: idField,
    slugField: nameField,
}
export default CandidatesDataSource
