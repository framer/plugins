import type { CollectionReferenceField, Field, RecruiteeDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const nameField: Field = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true }
const offerCountField: Field = { id: "offers_count", name: "Offer Count", type: "string", canBeUsedAsSlug: false }
const talentPoolsCountField: Field = { id: "talent_pools_count", name: "Talent Pools Count", type: "string", canBeUsedAsSlug: false }
const fields: Field[] = [
    idField,
    nameField,
    offerCountField,
    talentPoolsCountField
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
