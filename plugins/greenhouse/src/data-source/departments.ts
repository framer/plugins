import { jobsDataSource } from "./jobs"
import type { GreenhouseDataSource, GreenhouseField } from "./types"

const idField = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const nameField = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true } satisfies GreenhouseField
const jobsField = {
    id: "jobs",
    name: "Jobs",
    type: "multiCollectionReference",
    collectionId: "",
    getCollectionId: () => jobsDataSource.id,
    getValue: jobs => {
        if (Array.isArray(jobs)) {
            return jobs.map(job => String(job.id))
        }

        return []
    },
} satisfies GreenhouseField

export const departmentsDataSource = {
    id: "departments",
    name: "Departments",
    apiEndpoint: "departments",
    itemsKey: "departments",
    fields: [idField, nameField, jobsField],
    idField: idField.id,
    slugField: nameField.id,
} satisfies GreenhouseDataSource
