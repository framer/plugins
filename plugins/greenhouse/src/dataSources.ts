import type { ManagedCollectionFieldInput } from "framer-plugin"

export interface GreenhouseDataSource {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly GreenhouseField[]
    apiEndpoint: string
    itemsKey: string
}

export type GreenhouseField = ManagedCollectionFieldInput &
    (
        | {
              type: Exclude<ManagedCollectionFieldInput["type"], "collectionReference" | "multiCollectionReference">
              /** Used to transform the value of the field. Sometimes the value is inside an object, so we need to extract it. */
              getValue?: <T>(value: T) => unknown
              canBeUsedAsSlug?: boolean
          }
        | {
              type: "collectionReference" | "multiCollectionReference"
              getValue?: never
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const degreesDataSource = createDataSource({ name: "Degrees", apiEndpoint: "education/degrees" }, [
    { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
    { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
])
const schoolsDataSource = createDataSource({ name: "Schools", apiEndpoint: "education/schools" }, [
    { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
    { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
])
const disciplinesDataSource = createDataSource({ name: "Disciplines", apiEndpoint: "education/disciplines" }, [
    { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
    { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
])

const jobsDataSourceName = "Jobs"

const departmentsDataSource = createDataSource(
    { name: "Departments", apiEndpoint: "departments", itemsKey: "departments" },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        {
            id: "jobs",
            name: "Jobs",
            type: "multiCollectionReference",
            dataSourceId: jobsDataSourceName,
            collectionId: "",
        },
    ]
)
const officesDataSource = createDataSource({ name: "Offices", apiEndpoint: "offices", itemsKey: "offices" }, [
    { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
    { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
    { id: "location", name: "Location", type: "string" },
    {
        id: "departments",
        name: "Departments",
        type: "multiCollectionReference",
        collectionId: "",
        dataSourceId: departmentsDataSource.name,
    },
])
const jobsDataSource = createDataSource(
    { name: jobsDataSourceName, apiEndpoint: "jobs?content=true", itemsKey: "jobs" },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "internal_job_id", name: "Internal Job ID", type: "string", canBeUsedAsSlug: true },
        { id: "updated_at", name: "Updated At", type: "date" },
        { id: "requisition_id", name: "Requisition ID", type: "string" },
        {
            id: "location",
            name: "Location",
            type: "string",
            getValue: value => {
                if (typeof value === "object" && value !== null && "name" in value) {
                    return value.name
                }

                return null
            },
        },
        { id: "absolute_url", name: "Absolute URL", type: "link" },
        { id: "company_name", name: "Company Name", type: "string" },
        { id: "first_published", name: "First Published", type: "date" },
        {
            id: "offices",
            name: "Offices",
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: officesDataSource.name,
        },
        {
            id: "departments",
            name: "Departments",
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: departmentsDataSource.name,
        },
        { id: "content", name: "Content", type: "formattedText" },
    ]
)

const sectionsDataSource = createDataSource({ name: "Sections", apiEndpoint: "sections", itemsKey: "sections" }, [
    { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
    { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
    {
        id: "jobs",
        name: "Jobs",
        type: "multiCollectionReference",
        collectionId: "",
        dataSourceId: jobsDataSource.name,
    },
])

export const dataSources = [
    jobsDataSource,
    departmentsDataSource,
    officesDataSource,
    schoolsDataSource,
    disciplinesDataSource,
    degreesDataSource,
    sectionsDataSource,
] satisfies GreenhouseDataSource[]

function createDataSource(
    { name, apiEndpoint, itemsKey = "items" }: { name: string; apiEndpoint: string; itemsKey?: string },
    [idField, slugField, ...fields]: [GreenhouseField, GreenhouseField, ...GreenhouseField[]]
): GreenhouseDataSource {
    return {
        id: name,
        name,
        apiEndpoint,
        itemsKey,
        fields: [idField, slugField, ...fields],
    }
}

/**
 * Remove Greenhouse-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeGreenhouseKeys(fields: GreenhouseField[]): ManagedCollectionFieldInput[] {
    return fields.map(field => {
        delete field.getValue
        return field
    })
}
