
export interface Offer {
    id: number
    title: string
    department: string| null
    employment_type: string
    status: string
    candidates_count: number
    hired_candidates_count: number
    disqualified_candidates_count: number
    location: string| null
    street: string| null
    city: string| null
    state_name:string| null
    postal_code:string| null
    country_code:string| null
    mailbox_email: string
    requirements: string
    description: string
    offer_tags: string
    url:string
    enabled_for_referrals:boolean
    on_site:boolean
    remote:boolean
    published_at:string| null
    closed_at:string| null
}
export interface Location {
    id: number
    name: string
    city: string
    state_name: string
    country_code: string
    full_address: string
}

export interface Department {
    id: number
    name: string
    status: string
    offers_count: number
}

export interface Candidate {
    id: number
    name: string
    emails: string
    phones: string
    positive_ratings: number
}

export type RecruiteeItem = Offer | Location | Department | Candidate

export function isRecruiteeItemField<T extends RecruiteeItem>(field: unknown, itemType: T): field is keyof T {
    if (typeof field !== "string" || field === "") return false
    return Object.prototype.hasOwnProperty.call(itemType, field)
}
export function validateOffers(data: unknown): asserts data is Offer[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected offers data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected offer item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected offer to have numeric id")
        }
        if (typeof item.title !== "string") {
            throw new Error("Expected offer to have string title")
        }
        if ((item.department != null) && (typeof item.department !== "string")) {
            throw new Error("Expected candidates to have string department")
        }
        if (typeof item.employment_type !== "string") {
            throw new Error("Expected offer to have string employment type")
        }
        if (typeof item.status !== "string") {
            throw new Error("Expected offer to have string status")
        }
        if (typeof item.candidates_count !== "number") {
            throw new Error("Expected offer to have number candidates count")
        }
        if (typeof item.hired_candidates_count !== "number") {
            throw new Error("Expected offer to have number hired candidates count")
        }
        if (typeof item.disqualified_candidates_count !== "number") {
            throw new Error("Expected offer to have number disqualified candidates count")
        }
        if (typeof item.city !== "string") {
            throw new Error("Expected offer to have string city")
        }
        if (typeof item.mailbox_email !== "string") {
            throw new Error("Expected offer to have string email")
        }
        if (typeof item.requirements !== "string") {
            throw new Error("Expected offer to have string requirements")
        }
        if (typeof item.description !== "string") {
            throw new Error("Expected offer to have string description")
        }
        if (!Array.isArray(item.offer_tags)) {
            throw new Error("Expected candidates to have string emails")
        }
        if ((item.location != null) && (typeof item.location !== "string")) {
            throw new Error("Expected candidates to have string location")
        }
        if ((item.street != null) && (typeof item.street !== "string")) {
            throw new Error("Expected candidates to have string street")
        }
        if ((item.state_name != null) && (typeof item.state_name !== "string")) {
            throw new Error("Expected candidates to have string state name")
        }
        if ((item.postal_code != null) && (typeof item.postal_code !== "string")) {
            throw new Error("Expected candidates to have string postal code")
        }
        if ((item.country_code != null) && (typeof item.country_code !== "string")) {
            throw new Error("Expected candidates to have string country code")
        }
        if ((item.enabled_for_referrals != null) && (typeof item.enabled_for_referrals !== "boolean")) {
            throw new Error("Expected candidates to have boolean enabled for referrals")
        }
        if ((item.on_site != null) && (typeof item.on_site !== "boolean")) {
            throw new Error("Expected candidates to have boolean on site")
        }
        if ((item.remote != null) && (typeof item.remote !== "boolean")) {
            throw new Error("Expected candidates to have boolean remote")
        }
    }
}
export function validateLocations(data: unknown): asserts data is Location[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected locations data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected location item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected location to have numeric id")
        }
        if (typeof item.name !== "string") {
            throw new Error("Expected location to have string name")
        }
        if (typeof item.city !== "string") {
            throw new Error("Expected location to have string city")
        }
        if (typeof item.state_name !== "string") {
            throw new Error("Expected location to have string state")
        }
        if (typeof item.country_code !== "string") {
            throw new Error("Expected location to have string country code")
        }
        if (typeof item.full_address !== "string") {
            throw new Error("Expected location to have string full address")
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
        if ((item.status != null) && (typeof item.status !== "string")) {
            throw new Error("Expected department to have string status")
        }
        if (typeof item.offers_count !== "number") {
            throw new Error("Expected department to have number offer count")
        }
    }
}

export function validateCandidates(data: unknown): asserts data is Candidate[] {
    if (!Array.isArray(data)) {
        throw new Error("Expected candidates data to be an array")
    }

    for (const item of data) {
        if (typeof item !== "object" || item === null) {
            throw new Error("Expected candidates item to be an object")
        }
        if (typeof item.id !== "number") {
            throw new Error("Expected candidates to have numeric id")
        }
        if (typeof item.name !== "string") {
            throw new Error("Expected candidates to have string name")
        }
        if (!Array.isArray(item.emails)) {
            throw new Error("Expected candidates to have string emails")
        }
        if (!Array.isArray(item.phones)) {
            throw new Error("Expected candidates to have string phones")
        }
        if ((item.positive_ratings != null) && (typeof item.positive_ratings !== "number")) {
            throw new Error("Expected candidates to have number positive rating")
        }
    }
}