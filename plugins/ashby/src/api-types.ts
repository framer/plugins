export interface Job {
    id: string
    title: string
    location: string
    secondaryLocations: {
        location: string
        address: {
            addressLocality: string
            addressRegion: string
            addressCountry: string
        }
    }[]
    department: string | null
    team: string | null
    isListed: boolean
    isRemote: boolean
    descriptionHtml: string
    descriptionPlain: string
    publishedAt: string
    employmentType: string
    address: {
        postalAddress: {
            addressLocality: string
            addressRegion: string
            addressCountry: string
        }
    }
    jobUrl: string
    applyUrl: string
    compensation?: {
        compensationTierSummary: string
        scrapeableCompensationSalarySummary: string
        compensationTiers: unknown[]
        summaryComponents: unknown[]
    }
}



export type AshbyItem = Job

export function isAshbyItemField<T extends AshbyItem>(field: unknown, itemType: T): field is keyof T {
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
        if (typeof item.id !== "string") {
            throw new Error("Expected job to have string id")
        }
        if (typeof item.title !== "string") {
            throw new Error("Expected job to have a string 'title'")
        }
        if (typeof item.jobUrl !== "string") {
            throw new Error("Expected job to have a string 'jobUrl'")
        }
    }
}
