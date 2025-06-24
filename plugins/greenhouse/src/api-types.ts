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
    location: string
    jobs: Job[]
}

export interface Job {
    id: number
    internal_job_id: number | null
    title: string
    updated_at: string
    requisition_id: string
    absolute_url: string
    location: Location
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: any[]
    content: string
    departments: Department[]
    offices: Office[]
}

export interface Degree {
    id: number
    text: string
}

export interface School {
    id: number
    text: string
}

export interface Discipline {
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

export interface DegreesResponse {
    items: Degree[]
    meta: EducationMeta
}

export interface SchoolsResponse {
    items: School[]
    meta: EducationMeta
}

export interface DisciplinesResponse {
    items: Discipline[]
    meta: EducationMeta
}

export interface SectionsResponse {
    sections: Section[]
    meta: EducationMeta
}

export type GreenhouseItem = Job | Department | Office | Degree | School | Discipline | Section

export function isGreenhouseItemField<T extends GreenhouseItem>(field: unknown, itemType: T): field is keyof T {
    if (typeof field === "string" && field in itemType) {
        return true
    }

    return false
}
