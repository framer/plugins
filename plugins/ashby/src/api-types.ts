export interface Address {
    addressLocality: string
    addressRegion: string
    addressCountry: string
}

export interface CompensationComponent {
    id: string
    summary: string
    compensationType: string
    interval: string
    currencyCode: string | null
    minValue: number | null
    maxValue: number | null
}

export interface CompensationTiers {
    id: string
    tierSummary: string
    title: string
    additionalInformation: string | null
    components: CompensationComponent[]
}

export interface Job {
    id: string
    title: string
    location: string
    secondaryLocations: {
        location: string
        address: Address
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
        postalAddress: Address
    }
    jobUrl: string
    applyUrl: string
    compensation: {
        compensationTierSummary: string
        scrapeableCompensationSalarySummary: string
        compensationTiers: CompensationTiers[]
        summaryComponents: CompensationComponent[]
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
        if (typeof item.isListed !== "boolean") {
            throw new Error("Expected job to have a boolean 'isListed'")
        }
        if (typeof item.address !== "object" || item.address === null) {
            throw new Error("Expected job to have an 'address' object")
        }
        if (typeof item.address.postalAddress !== "object" || item.address.postalAddress === null) {
            throw new Error("Expected job address to have a 'postalAddress' object")
        }
        if (typeof item.compensation !== "object" || item.compensation === null) {
            throw new Error("Expected job to have an 'compensation' object")
        }
        if (typeof item.compensation.compensationTiers !== "object" || item.compensation.compensationTiers === null) {
            throw new Error("Expected job to have an 'compensation.compensationTiers' object")
        }
        if (typeof item.compensation.summaryComponents !== "object" || item.compensation.summaryComponents === null) {
            throw new Error("Expected job to have an 'compensation.summaryComponents' object")
        }
    }
}
