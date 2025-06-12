import DepartmentsDataSource from "./departments"
import type { CollectionReferenceField, Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const nameField: Field = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true }
const locationField: Field = {
    id: "location",
    name: "Location",
    type: "string",
}
const departmentsField: CollectionReferenceField = {
    id: "departments",
    name: "Departments",
    type: "multiCollectionReference",
    getCollection: () => DepartmentsDataSource,
    map: (value: { id: number }[]) => value.map(department => String(department.id)),
}

const fields: Field[] = [idField, nameField, locationField, departmentsField]

const OfficesDataSource: GreenhouseDataSource = {
    id: "offices",
    name: "Offices",
    apiEndpoint: "offices",
    itemsKey: "offices",
    fields,
    idField: idField,
    slugField: nameField,
}

export default OfficesDataSource
