// import CategoryDataSource from "./categories"

import type { CollectionReferenceField, Field, RecruiteeDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const nameField: Field = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true }
const updatedAtField: Field = { id: "updated_at", name: "Updated At", type: "date" }
const cityField: Field = {
    id: "city",
    name: "City",
    type: "string"
}
const stateField: Field = {
    id: "state_name",
    name: "State",
    type: "string"
}
const fields: Field[] = [
    idField,
    nameField,
    cityField,
    stateField,
    updatedAtField
]

const LocationsDataSource: RecruiteeDataSource = {
    id: "locations",
    name: "Locations",
    apiEndpoint: "locations?content=true",
    itemsKey: "locations",
    fields,
    idField: idField,
    slugField: nameField,
}
export default LocationsDataSource
