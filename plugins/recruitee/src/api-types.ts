
export interface Offer {
    id: number
    title: string
    city: string
}
export interface Location {
    id: number
    name: string
    city: string
}

export interface Department {
    id: number
    name: string
}

export interface Candidate {
    id: number
    name: string
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
    }
}

export function validateCandidates(data: unknown): asserts data is Candidate[] {
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
    }
}