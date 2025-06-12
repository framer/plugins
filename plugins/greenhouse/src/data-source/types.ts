import type { ManagedCollectionFieldInput } from "framer-plugin"
import JobsDataSource from "./jobs"
import DepartmentsDataSource from "./departments"
import SectionsDataSource from "./sections"
import SchoolsDataSource from "./schools"
import DisciplinesDataSource from "./disciplines"
import DegreesDataSource from "./degrees"
import OfficesDataSource from "./offices"

export type Field = {
    id: string
    name: string
    type: ManagedCollectionFieldInput["type"]
    map?: (value: any) => any
    canBeUsedAsSlug?: boolean
}
export type CollectionReferenceField = Field & {
    type: "collectionReference" | "multiCollectionReference"
    getCollection: () => GreenhouseDataSource // this to avoid circular dependencies
    map?: (value: any) => string[]
}

export type GreenhouseDataSource = {
    id: string
    name: string
    fields: Field[] | CollectionReferenceField[]
    idField: Field
    slugField?: Field
    apiEndpoint: string
    itemsKey: string
}

export const dataSources: GreenhouseDataSource[] = [
    JobsDataSource,
    DepartmentsDataSource,
    OfficesDataSource,
    SchoolsDataSource,
    DisciplinesDataSource,
    DegreesDataSource,
    SectionsDataSource,
]
