import JobsDataSource from "./jobs"
import type { CollectionReferenceField, Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true }
const nameField: Field = { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true }
const jobsField: CollectionReferenceField = {
    id: "jobs",
    name: "Jobs",
    type: "multiCollectionReference",
    getCollection: () => JobsDataSource,
    map: (jobs: { id: number }[]) => jobs.map(job => String(job.id)),
}

const fields: Field[] = [idField, nameField, jobsField]

const SectionsDataSource: GreenhouseDataSource = {
    id: "sections",
    name: "Sections",
    apiEndpoint: "sections",
    itemsKey: "sections",
    fields,
    idField: idField,
    slugField: nameField,
}

export default SectionsDataSource
