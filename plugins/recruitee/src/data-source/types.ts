import type { ManagedCollectionFieldInput } from "framer-plugin"
import OffersDataSource from "./offers"
import LocationsDataSource from "./locations";
import DepartmentsDataSource from "./departments";

export type Field = {
    id: string
    name: string
    type: ManagedCollectionFieldInput["type"]
    map?: (value: any) => any
    canBeUsedAsSlug?: boolean
}
export type CollectionReferenceField = Field & {
    type: "collectionReference" | "multiCollectionReference"
    getCollection: () => RecruiteeDataSource // this is a function to avoid circular dependencies
    map?: (value: any) => string[]
}

export type RecruiteeDataSource = {
    id: string
    name: string
    fields: Field[] | CollectionReferenceField[]
    idField: Field
    slugField?: Field
    apiEndpoint: string
    itemsKey: string
}

export const dataSources: RecruiteeDataSource[] = [
    OffersDataSource,
    LocationsDataSource,
    DepartmentsDataSource
]
