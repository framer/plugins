import { ManagedCollectionField, framer } from "framer-plugin"

/**
 * Utility function to decode HTML entities in strings
 */
function decodeHtml(html: string) {
    const textarea = document.createElement("textarea")
    textarea.innerHTML = html
    return textarea.value
}

type CollectionFieldType = ManagedCollectionField["type"]

/**
 * Available field types for Framer collections
 */
export const FIELD_TYPE_OPTIONS: { type: CollectionFieldType; label: string }[] = [
    { type: "boolean", label: "Boolean" },
    { type: "color", label: "Color" },
    { type: "number", label: "Number" },
    { type: "string", label: "String" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "image", label: "Image" },
    { type: "link", label: "Link" },
    { type: "date", label: "Date" },
    { type: "enum", label: "Option" },
    { type: "file", label: "File" },
]

/**
 * Type definitions for Greenhouse API responses
 */
export type Job = {
    id: string
    internal_job_id: string
    title: string
    updated_at: string
    requisition_id: string
    location: {
        name: string
    }
    absolute_url: string
    content: string
    departments: Department[]
    offices: Office[]
}

export type Department = {
    id: string
    name: string
    jobs: Job[]
}

export type Office = {
    id: string
    name: string
    departments: Department[]
}

export type Degree = {
    id: string
    text: string
}

export type Discipline = {
    id: string
    text: string
}

export type School = {
    id: string
    text: string
}

export type Section = {
    id: string
    name: string
    jobs: Job[]
}

/**
 * Content type definitions mapping Greenhouse data to Framer collections
 */
export const CONTENT_TYPES = [
    {
        id: "jobs",
        name: "Jobs",
        path: "/jobs",
        key: "jobs",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "internal_job_id",
                name: "Internal Job ID",
                type: "string",
            },
            {
                id: "title",
                name: "Title",
                type: "string",
            },
            {
                id: "updated_at",
                name: "Updated At",
                type: "date",
            },
            {
                id: "requisition_id",
                name: "Requisition ID",
                type: "string",
            },
            {
                id: "location",
                name: "Location",
                type: "string",
            },
            {
                id: "absolute_url",
                name: "Absolute URL",
                type: "link",
            },
            {
                id: "content",
                name: "Content",
                type: "formattedText",
            },
            {
                id: "departments",
                name: "Departments",
                type: "multiCollectionReference",
                contentTypeId: "departments",
            },
            {
                id: "offices",
                name: "Offices",
                type: "multiCollectionReference",
                contentTypeId: "offices",
            },
        ],
        mapEntry: (entry: Job) => {
            return {
                id: String(entry?.id),
                internal_job_id: String(entry?.internal_job_id),
                title: entry?.title,
                updated_at: String(entry?.updated_at),
                requisition_id: String(entry?.requisition_id),
                location: entry?.location?.name,
                absolute_url: String(entry?.absolute_url),
                content: decodeHtml(entry?.content),
                departments: entry?.departments?.map((department: Department) => String(department.id)),
                offices: entry?.offices?.map((office: Office) => String(office.id)),
            }
        },
    },
    {
        id: "offices",
        name: "Offices",
        path: "/offices",
        key: "offices",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "name",
                name: "Name",
                type: "string",
            },
            {
                id: "departments",
                name: "Departments",
                type: "multiCollectionReference",
                contentTypeId: "departments",
            },
        ],
        mapEntry: (entry: Office) => {
            return {
                id: String(entry?.id),
                name: entry?.name,
                departments: entry?.departments?.map((department: Department) => String(department.id)),
            }
        },
    },
    {
        id: "departments",
        name: "Departments",
        path: "/departments",
        key: "departments",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "name",
                name: "Name",
                type: "string",
            },
            {
                id: "jobs",
                name: "Jobs",
                type: "multiCollectionReference",
                contentTypeId: "jobs",
            },
        ],
        mapEntry: (entry: Department) => {
            return {
                id: String(entry?.id),
                name: entry?.name,
                jobs: entry?.jobs?.map((job: Job) => String(job.id)),
            }
        },
    },
    {
        id: "degrees",
        name: "Degrees",
        path: "/education/degrees",
        key: "items",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "text",
                name: "text",
                type: "string",
            },
        ],
        mapEntry: (entry: Degree) => {
            return {
                id: String(entry?.id),
                text: entry?.text,
            }
        },
    },
    {
        id: "disciplines",
        name: "Disciplines",
        path: "/education/disciplines",
        key: "items",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "text",
                name: "text",
                type: "string",
            },
        ],
        mapEntry: (entry: Discipline) => {
            return {
                id: String(entry?.id),
                text: entry?.text,
            }
        },
    },
    {
        id: "schools",
        name: "Schools",
        path: "/education/schools",
        key: "items",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "text",
                name: "text",
                type: "string",
            },
        ],
        mapEntry: (entry: School) => {
            return {
                id: String(entry?.id),
                text: entry?.text,
            }
        },
    },
    {
        id: "sections",
        name: "Sections",
        path: "/sections",
        key: "sections",
        fields: [
            {
                id: "id",
                name: "ID",
                type: "string",
            },
            {
                id: "name",
                name: "Name",
                type: "string",
            },
            {
                id: "jobs",
                name: "Jobs",
                type: "multiCollectionReference",
                contentTypeId: "jobs",
            },
        ],
        mapEntry: (entry: Section) => {
            return {
                id: String(entry?.id),
                name: entry?.name,
                jobs: entry?.jobs?.map((job: Job) => String(job.id)),
            }
        },
    },
] as const

// Current Greenhouse token
let greenhouseToken = ""

/**
 * Initialize Greenhouse API with board token
 */
export async function initGreenhouse(boardToken: string) {
    if (!boardToken || boardToken.trim() === "") {
        const error = new Error("Board token is required")
        framer.notify("Board token is required", {
            variant: "error",
            durationMs: 3000
        })
        throw error
    }
    
    if (greenhouseToken === boardToken) return true

    try {
        const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}`)
        
        if (!response.ok) {
            let errorMessage = "";
            
            if (response.status === 401 || response.status === 403) {
                errorMessage = "Invalid board token or insufficient permissions";
            } else if (response.status === 404) {
                errorMessage = "Board not found. Please check your board token";
            } else if (response.status >= 500) {
                errorMessage = "Greenhouse API server error. Please try again later";
            } else {
                errorMessage = `API request failed with status ${response.status}: ${response.statusText}`;
            }
            
            throw new Error(errorMessage)
        }

        greenhouseToken = boardToken
        return true
    } catch (error) {
        if (error instanceof TypeError && error.message.includes("fetch")) {
            const networkError = new Error("Network error. Please check your internet connection")
            throw networkError
        }
        
        throw error
    }
}

/**
 * Get content type data from Greenhouse API
 */
export async function getContentType(
    contentType: string,
    all: boolean = true
): Promise<Job[] | Department[] | Office[] | Degree[] | Discipline[] | School[] | Section[]> {
    if (!greenhouseToken) {
        throw new Error("Greenhouse token not set")
    }

    const contentTypeDefinition = CONTENT_TYPES.find(ct => ct.id === contentType)
    if (!contentTypeDefinition) {
        throw new Error(`Content type not found: ${contentType}`)
    }

    try {
        const response = await fetch(
            `https://boards-api.greenhouse.io/v1/boards/${greenhouseToken}${contentTypeDefinition.path}?content=true`
        )

        if (!response.ok) {
            let errorMessage = `API request failed with status ${response.status}: ${response.statusText}`
            
            if (response.status === 401 || response.status === 403) {
                errorMessage = "Invalid board token or insufficient permissions"
            } else if (response.status === 404) {
                errorMessage = "Resource not found. Please check your board token"
            } else if (response.status >= 500) {
                errorMessage = "Greenhouse API server error. Please try again later"
            }
            
            throw new Error(errorMessage)
        }

        const data = await response.json()
        
        if (!data) {
            throw new Error("Failed to parse API response")
        }

        const count = data?.meta?.total_count
        const perPage = data?.meta?.per_page

        if (count > perPage && all) {
            const pages = Math.ceil(count / perPage)
            const promises = []

            for (let i = 1; i <= pages; i++) {
                promises.push(
                    fetch(
                        `https://boards-api.greenhouse.io/v1/boards/${greenhouseToken}${contentTypeDefinition.path}?page=${i}`
                    )
                )
            }

            try {
                const results = await Promise.all(promises)
                
                const failedRequests = results.filter(r => !r.ok)
                if (failedRequests.length > 0) {
                    throw new Error(`${failedRequests.length} pagination requests failed`)
                }
                
                const jsonPromises = results.map(async (r) => {
                    try {
                        return await r.json()
                    } catch (error) {
                        throw new Error(`Failed to parse paginated response: ${error instanceof Error ? error.message : String(error)}`)
                    }
                })
                
                const data = await Promise.all(jsonPromises)
                
                const validData = data.every(d => Array.isArray(d.items))
                if (!validData) {
                    throw new Error("Invalid data format in paginated responses")
                }
                
                return data.map(({ items }) => items).flat()
            } catch (error) {
                throw new Error(`Failed to fetch paginated data: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        const key = contentTypeDefinition.key
        if (!key) {
            throw new Error(`Content type key not found for ${contentType}`)
        }

        if (!data[key]) {
            throw new Error(`Data for key '${key}' not found in API response`)
        }

        return data[key]
    } catch (error) {
        throw new Error(`Failed to fetch content type ${contentType}: ${error instanceof Error ? error.message : String(error)}`)
    }
}

/**
 * Get all content types from Greenhouse API
 */
export async function getAllContentTypes(
    all: boolean = true
): Promise<Record<string, Job[] | Department[] | Office[] | Degree[] | Discipline[] | School[] | Section[]>> {
    if (!greenhouseToken) {
        throw new Error("Greenhouse token not set")
    }

    try {
        const contentTypesPromises = CONTENT_TYPES.map(async ct => {
            try {
                const data = await getContentType(ct.id, all)
                return [ct.id, data]
            } catch (error) {
                return [ct.id, []]
            }
        })

        const contentTypes = await Promise.all(contentTypesPromises)
        return Object.fromEntries(contentTypes)
    } catch (error) {
        throw new Error(`Failed to fetch all content types: ${error instanceof Error ? error.message : String(error)}`)
    }
}
