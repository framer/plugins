import { departmentsDataSource } from "./departments"
import type { GreenhouseDataSource, GreenhouseField } from "./types"

const idField = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const nameField = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const locationField = {
    id: "location",
    name: "Location",
    type: "string",
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

export const officesDataSource = {
    id: "offices",
    name: "Offices",
    apiEndpoint: "offices",
    itemsKey: "offices",
    fields: [idField, nameField, locationField, departmentsField],
    idField: idField.id,
    slugField: nameField.id,
} satisfies GreenhouseDataSource
