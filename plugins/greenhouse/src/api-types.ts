interface Location {
    name: string
}

export interface Department {
    id: number
    name: string
    jobs: Job[]
}

export interface Office {
    id: number
    name: string
    location: string | null
    departments: Department[]
}

export interface Job {
    id: number
    internal_job_id: number
    title: string
    updated_at: string
    requisition_id: string | null
    absolute_url: string
    location: Location
    content: string
    departments: Department[]
    offices: Office[]
}

export interface Education {
    id: number
    text: string
}

export interface Section {
    id: number
    name: string
    jobs: Job[]
}

export interface JobListResponse {
    jobs: Job[]
    meta: { total: number }
}

export interface DepartmentResponse {
    departments: Department[]
}

export interface OfficeResponse {
    offices: Office[]
}

interface EducationMeta {
    total_count: number
    per_page: number
}

export interface EducationResponse {
    items: Education[]
    meta: EducationMeta
}

export interface SectionsResponse {
    sections: Section[]
    meta: EducationMeta
}

export type GreenhouseItem = Job | Department | Office | Education | Section

export function isGreenhouseItemField<T extends GreenhouseItem>(field: unknown, itemType: T): field is keyof T {
    if (typeof field !== "string" || field === "") return false
    return Object.prototype.hasOwnProperty.call(itemType, field)
}

export function validateJobs(data: unknown): asserts data is Job[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected jobs data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected job item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected job to have numeric id")
        }
        if (typeof item.internal_job_id !== "number") {
            throw new Error("Expected job to have numeric internal_job_id")
        }
        if (typeof item.title !== "string") {
            throw new Error("Expected job to have string title")
        }
        if (typeof item.updated_at !== "string") {
            throw new Error("Expected job to have string updated_at")
        }
        if (typeof item.requisition_id !== "string" && item.requisition_id !== null) {
            throw new Error("Expected job to have string requisition_id")
        }
        if (typeof item.absolute_url !== "string") {
            throw new Error("Expected job to have string absolute_url")
        }
        if (typeof item.location !== "object" || item.location === null) {
            throw new Error("Expected job to have object location")
        }
        if (typeof item.location.name !== "string") {
            throw new Error("Expected job to have string location.name")
        }
        if (typeof item.content !== "string") {
            throw new Error("Expected job to have string content")
        }
        if (!Array.isArray(item.departments)) {
            throw new Error("Expected job to have departments array")
        }
        if (!Array.isArray(item.offices)) {
            throw new Error("Expected job to have offices array")
        }
    }
}

export function validateOffices(data: unknown): asserts data is Office[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected offices data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected office item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected office to have numeric id")
        }
        if (typeof item.name !== "string") {
            throw new Error("Expected office to have string name")
        }
        if (typeof item.location !== "string" && item.location !== null) {
            throw new Error("Expected office to have string location")
        }
        if (!Array.isArray(item.departments)) {
            throw new Error("Expected office to have departments array")
        }
    }
}

export function validateDepartments(data: unknown): asserts data is Department[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected departments data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected department item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected department to have numeric id")
        }
        if (typeof item.name !== "string") {
            throw new Error("Expected department to have string name")
        }
        if (!Array.isArray(item.jobs)) {
            throw new Error("Expected department to have jobs array")
        }
    }
}

export function validateEducations(data: unknown): asserts data is Education[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected educations data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected education item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected education to have numeric id")
        }
        if (typeof item.text !== "string") {
            throw new Error("Expected education to have string text")
        }
    }
}

export function validateSections(data: unknown): asserts data is Section[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected sections data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected section item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected section to have numeric id")
        }
        if (typeof item.name !== "string") {
            throw new Error("Expected section to have string name")
        }
        if (!Array.isArray(item.jobs)) {
            throw new Error("Expected section to have jobs array")
        }
    }
}
