import type { ManagedCollectionFieldInput } from "framer-plugin"
import {
    type GreenhouseItem,
    validateDepartments,
    validateEducations,
    validateJobs,
    validateOffices,
    validateSections,
} from "./api-types"

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
    apiPath: string
    fetch: (boardToken: string) => Promise<GreenhouseItem[]>
}

async function fetchGreenhouseData(url: string, itemsKey: string): Promise<unknown[]> {
    try {
        const response = await fetch(url)
        const data = await response.json()
        const items = []

        if (data?.meta?.total_count && data?.meta?.per_page) {
            const pages = Math.ceil(data.meta.total_count / data.meta.per_page)
            for (let i = 0; i < pages; i++) {
                const response = await fetch(`${url}?page=${i + 1}`)
                const data = await response.json()
                items.push(...(data[itemsKey] as unknown[]))
            }
        } else {
            items.push(...(data[itemsKey] as unknown[]))
        }

        return items
    } catch (error) {
        console.error("Error fetching Greenhouse data:", error)
        throw error
    }
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

const degreesDataSource = createDataSource(
    {
        name: "Degrees",
        apiPath: "education/degrees",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/degrees`
            const items = await fetchGreenhouseData(url, "items")
            validateEducations(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
    ]
)
const schoolsDataSource = createDataSource(
    {
        name: "Schools",
        apiPath: "education/schools",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/schools`
            const items = await fetchGreenhouseData(url, "items")
            validateEducations(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
    ]
)
const disciplinesDataSource = createDataSource(
    {
        name: "Disciplines",
        apiPath: "education/disciplines",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/disciplines`
            const items = await fetchGreenhouseData(url, "items")
            validateEducations(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
    ]
)

const jobsDataSourceName = "Jobs"

const departmentsDataSource = createDataSource(
    {
        name: "Departments",
        apiPath: "departments",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/departments`
            const items = await fetchGreenhouseData(url, "departments")
            validateDepartments(items)
            return items
        },
    },
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
const officesDataSource = createDataSource(
    {
        name: "Offices",
        apiPath: "offices",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/offices`
            const items = await fetchGreenhouseData(url, "offices")
            validateOffices(items)
            return items
        },
    },
    [
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
    ]
)
const jobsDataSource = createDataSource(
    {
        name: jobsDataSourceName,
        apiPath: "jobs?content=true",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`
            const items = await fetchGreenhouseData(url, "jobs")
            validateJobs(items)
            return items
        },
    },
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

const sectionsDataSource = createDataSource(
    {
        name: "Sections",
        apiPath: "sections",
        fetch: async (boardToken: string) => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/sections`
            const items = await fetchGreenhouseData(url, "sections")
            validateSections(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        {
            id: "jobs",
            name: "Jobs",
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: jobsDataSource.name,
        },
    ]
)

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
    {
        name,
        apiPath,
        fetch,
    }: {
        name: string
        apiPath: string
        fetch: (boardToken: string) => Promise<GreenhouseItem[]>
    },
    [idField, slugField, ...fields]: [GreenhouseField, GreenhouseField, ...GreenhouseField[]]
): GreenhouseDataSource {
    return {
        id: name,
        name,
        apiPath,
        fields: [idField, slugField, ...fields],
        fetch,
    }
}

/**
 * Remove Greenhouse-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeGreenhouseKeys(fields: GreenhouseField[]): ManagedCollectionFieldInput[] {
    return fields.map(originalField => {
        const field = { ...originalField }
        delete field.getValue
        return field
    })
}
