import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import {
    type Department,
    DepartmentSchema,
    type Education,
    EducationSchema,
    type GreenhouseItem,
    type Job,
    JobSchema,
    type Office,
    OfficeSchema,
    type Section,
    SectionSchema,
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
    fetch: (boardToken: string) => Promise<GreenhouseItem[]>
}

const PaginationDataSchema = v.object({ meta: v.object({ total_count: v.number(), per_page: v.number() }) })

async function fetchGreenhousePages(url: string): Promise<unknown[]> {
    try {
        const response = await fetch(url)
        const data = (await response.json()) as unknown
        const pages = []

        if (v.is(PaginationDataSchema, data)) {
            const numberOfPages = Math.ceil(data.meta.total_count / data.meta.per_page)
            for (let i = 1; i <= numberOfPages; i += 1) {
                const response = await fetch(`${url}?page=${i}`)
                const pageData = (await response.json()) as unknown
                pages.push(pageData)
            }
        } else {
            pages.push(data)
        }

        return pages
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
              getValue?: (value: unknown) => unknown
              canBeUsedAsSlug?: boolean
          }
        | {
              type: "collectionReference" | "multiCollectionReference"
              getValue?: never
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const EducationPagesSchema = v.array(v.object({ items: v.array(EducationSchema) }))

const degreesDataSource = createDataSource(
    {
        name: "Degrees",
        fetch: async (boardToken: string): Promise<Education[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/degrees`
            const items = v.parse(EducationPagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.items)
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
        fetch: async (boardToken: string): Promise<Education[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/schools`
            const items = v.parse(EducationPagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.items)
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
        fetch: async (boardToken: string): Promise<Education[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/education/disciplines`
            const items = v.parse(EducationPagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.items)
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "text", name: "Name", type: "string", canBeUsedAsSlug: true },
    ]
)

const DepartmentPagesSchema = v.array(v.object({ departments: v.array(DepartmentSchema) }))

const jobsDataSourceName = "Jobs"

const departmentsDataSource = createDataSource(
    {
        name: "Departments",
        fetch: async (boardToken: string): Promise<Department[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/departments`
            const items = v.parse(DepartmentPagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.departments)
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

const OfficePagesSchema = v.array(v.object({ offices: v.array(OfficeSchema) }))

const officesDataSource = createDataSource(
    {
        name: "Offices",
        fetch: async (boardToken: string): Promise<Office[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/offices`
            const items = v.parse(OfficePagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.offices)
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

const JobPagesSchema = v.array(v.object({ jobs: v.array(JobSchema) }))

const jobsDataSource = createDataSource(
    {
        name: jobsDataSourceName,
        fetch: async (boardToken: string): Promise<Job[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`
            const items = v.parse(JobPagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.jobs)
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
            name: officesDataSource.name,
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: officesDataSource.name,
        },
        {
            id: "departments",
            name: departmentsDataSource.name,
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: departmentsDataSource.name,
        },
        { id: "content", name: "Content", type: "formattedText" },
    ]
)

const SectionPagesSchema = v.array(v.object({ sections: v.array(SectionSchema) }))

const sectionsDataSource = createDataSource(
    {
        name: "Sections",
        fetch: async (boardToken: string): Promise<Section[]> => {
            const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/sections`
            const items = v.parse(SectionPagesSchema, await fetchGreenhousePages(url))
            return items.flatMap(page => page.sections)
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        {
            id: "jobs",
            name: jobsDataSource.name,
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
        fetch,
    }: {
        name: string
        fetch: (boardToken: string) => Promise<GreenhouseItem[]>
    },
    [idField, slugField, ...fields]: [GreenhouseField, GreenhouseField, ...GreenhouseField[]]
): GreenhouseDataSource {
    return {
        id: name,
        name,
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
