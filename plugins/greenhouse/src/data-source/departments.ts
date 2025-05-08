// import CategoryDataSource from "./categories"
import JobsDataSource from "./jobs"
import type { CollectionReferenceField, Field, GreenhouseDataSource } from "./types"

const idField: Field = { id: "id", name: "id", type: "string" }
const nameField: Field = { id: "name", name: "Name", type: "string" }
const jobsField: CollectionReferenceField = {
    id: "jobs",
    name: "Jobs",
    type: "multiCollectionReference",
    getCollection: () => JobsDataSource,
    map: (jobs: { id: number }[]) => jobs.map(job => String(job.id)),
}

const fields: Field[] = [idField, nameField, jobsField]

const DepartmentsDataSource: GreenhouseDataSource = {
    id: "departments",
    name: "Departments",
    apiEndpoint: "departments",
    itemsKey: "departments",
    fields,
    idField: idField,
    slugField: nameField,
}

export default DepartmentsDataSource
