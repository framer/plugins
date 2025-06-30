import type { ManagedCollectionFieldInput } from "framer-plugin"
import {
    type AshbyItem,
    // validateDepartments,
    // validateEducations,
    validateJobs,
    // validateOffices,
    // validateSections,
} from "./api-types"

export interface AshbyDataSource {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly AshbyField[]
    apiPath: string
    fetch: (boardToken: string) => Promise<AshbyItem[]>
}

async function fetchAshbyData(url: string, itemsKey: string): Promise<unknown[]> {
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
        console.error("Error fetching Ashby data:", error)
        throw error
    }
}

export type AshbyField = ManagedCollectionFieldInput &
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

// const degreesDataSource = createDataSource(
//     {
//         name: "Degrees",
//         apiPath: "education/degrees",
//         fetch: async (boardToken: string) => {
//             const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/degrees`
//             const items = await fetchAshbyData(url, "items")
//             validateEducations(items)
//             return items
//         },
//     },
//     [
//         { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
//         { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
//     ]
// )

// const schoolsDataSource = createDataSource(
//     {
//         name: "Schools",
//         apiPath: "education/schools",
//         fetch: async (boardToken: string) => {
//             const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/schools`
//             const items = await fetchAshbyData(url, "items")
//             validateEducations(items)
//             return items
//         },
//     },
//     [
//         { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
//         { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
//     ]
// )

// const disciplinesDataSource = createDataSource(
//     {
//         name: "Disciplines",
//         apiPath: "education/disciplines",
//         fetch: async (boardToken: string) => {
//             const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/disciplines`
//             const items = await fetchAshbyData(url, "items")
//             validateEducations(items)
//             return items
//         },
//     },
//     [
//         { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
//         { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
//     ]
// )

const jobsDataSourceName = "Jobs"

// const departmentsDataSource = createDataSource(
//     {
//         name: "Departments",
//         apiPath: "departments",
//         fetch: async (boardToken: string) => {
//             const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/departments`
//             const items = await fetchAshbyData(url, "departments")
//             validateDepartments(items)
//             return items
//         },
//     },
//     [
//         { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
//         { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
//         {
//             id: "jobs",
//             name: "Jobs",
//             type: "multiCollectionReference",
//             dataSourceId: jobsDataSourceName,
//             collectionId: "",
//         },
//     ]
// )
// const officesDataSource = createDataSource(
//     {
//         name: "Offices",
//         apiPath: "offices",
//         fetch: async (boardToken: string) => {
//             const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/offices`
//             const items = await fetchAshbyData(url, "offices")
//             validateOffices(items)
//             return items
//         },
//     },
//     [
//         { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
//         { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
//         { id: "location", name: "Location", type: "string" },
//         {
//             id: "departments",
//             name: "Departments",
//             type: "multiCollectionReference",
//             collectionId: "",
//             dataSourceId: departmentsDataSource.name,
//         },
//     ]
// )

const jobsDataSource = createDataSource(
    {
        name: jobsDataSourceName,
        apiPath: "job-board",
        fetch: async (boardToken: string) => {
            const url = `https://api.ashbyhq.com/posting-api/job-board/${boardToken}?includeCompensation=true`
            const items = await fetchAshbyData(url, "jobs")
            validateJobs(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "descriptionPlain", name: "Description", type: "formattedText" },
        { id: "department", name: "Department", type: "string" },
        { id: "team", name: "Team", type: "string" },
        { id: "location", name: "Location", type: "string" },
        { id: "employmentType", name: "Employment Type", type: "string" },
        { id: "isRemote", name: "Remote", type: "boolean" },
        { id: "publishedAt", name: "Published At", type: "date" },
        { id: "jobUrl", name: "Job URL", type: "link" },
        { id: "applyUrl", name: "Apply URL", type: "link" },
        { id: "compensation", name: "Compensation", type: "string" },
    ]
)

// const sectionsDataSource = createDataSource(
//     {
//         name: "Sections",
//         apiPath: "sections",
//         fetch: async (boardToken: string) => {
//             const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/sections`
//             const items = await fetchAshbyData(url, "sections")
//             validateSections(items)
//             return items
//         },
//     },
//     [
//         { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
//         { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
//         {
//             id: "jobs",
//             name: "Jobs",
//             type: "multiCollectionReference",
//             collectionId: "",
//             dataSourceId: jobsDataSource.name,
//         },
//     ]
// )

export const dataSources = [
    jobsDataSource,
    // departmentsDataSource,
    // officesDataSource,
    // schoolsDataSource,
    // disciplinesDataSource,
    // degreesDataSource,
    // sectionsDataSource,
] satisfies AshbyDataSource[]

function createDataSource(
    {
        name,
        apiPath,
        fetch,
    }: {
        name: string
        apiPath: string
        fetch: (boardToken: string) => Promise<AshbyItem[]>
    },
    [idField, slugField, ...fields]: [AshbyField, AshbyField, ...AshbyField[]]
): AshbyDataSource {
    return {
        id: name,
        name,
        apiPath,
        fields: [idField, slugField, ...fields],
        fetch,
    }
}

/**
 * Remove Ashby-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeAshbyKeys(fields: AshbyField[]): ManagedCollectionFieldInput[] {
    return fields.map(originalField => {
        const field = { ...originalField }
        delete field.getValue
        return field
    })
}
