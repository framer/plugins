import type { ManagedCollectionFieldInput } from "framer-plugin"
import {
    type RecruiteeItem,
    validateOffers,
    validateLocations,
    validateDepartments,
    validateCandidates
} from "./api-types"

export interface RecruiteeDataSource {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly RecruiteeField[]
    apiPath: string
    fetch: (boardToken: string, companyId: string) => Promise<RecruiteeItem[]>
}

async function fetchRecruiteeData(url: string, boardToken: string, itemsKey: string): Promise<unknown[]> {
    try {
        const response = await fetch(url, {
            headers: new Headers({
                'Authorization': 'Bearer '+boardToken
            })
        })
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
        console.error("Error fetching Recruitee data:", error)
        throw error
    }
}

export type RecruiteeField = ManagedCollectionFieldInput &
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

const locationDataSource = createDataSource(
    {
        name: "Locations",
        apiPath: "locations",
        fetch: async (boardToken: string, companyId:string) => {
            const url = `https://api.recruitee.com/c/${companyId}/locations`
            const items = await fetchRecruiteeData(url, boardToken, "locations")
            validateLocations(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "city", name: "City", type: "string"},
        { id: "state_name", name: "State", type: "string"},
        { id: "country_code", name: "Country", type: "string"},
        { id: "full_address", name: "Full Address", type: "string"},
    ]
)

const offersDataSource = createDataSource(
    {
        name: "Offers",
        apiPath: "offers",
        fetch: async (boardToken: string, companyId:string) => {
            const url = `https://api.recruitee.com/c/${companyId}/offers`
            const items = await fetchRecruiteeData(url, boardToken, "offers")
            validateOffers(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "employment_type", name: "Type", type: "string" },
        { id: "status", name: "Status", type: "string" },
        { id: "candidates_count", name: "Candidates Count", type: "string" },
        { id: "hired_candidates_count", name: "Hired Candidates Count", type: "string" },
        { id: "disqualified_candidates_count", name: "Disqualified Candidates Count", type: "string" },
        { id: "city", name: "City", type: "string" },
        { id: "mailbox_email", name: "Email", type: "string" },
        { id: "company_name", name: "Company", type: "string" },
        { id: "requirements", name: "Requirements", type: "formattedText" },
        { id: "description", name: "Description", type: "formattedText" },
        { id: "offer_tags", name: "Tags", type: "string" }
    ]
)

const departmentsDataSource = createDataSource(
    {
        name: "Departments",
        apiPath: "departments",
        fetch: async (boardToken: string, companyId:string) => {
            const url = `https://api.recruitee.com/c/${companyId}/departments`
            const items = await fetchRecruiteeData(url, boardToken, "departments")
            validateDepartments(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "status", name: "Status", type: "string" },
        { id: "offers_count", name: "Offers Count", type: "string" }
    ]
)

const candidatesDataSource = createDataSource(
    {
        name: "Candidates",
        apiPath: "candidates",
        fetch: async (boardToken: string, companyId:string) => {
            const url = `https://api.recruitee.com/c/${companyId}/candidates`
            const items = await fetchRecruiteeData(url, boardToken, "candidates")
            validateCandidates(items)
            return items
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "emails", name: "Emails", type: "string"},
        { id: "phones", name: "Phones", type: "string"},
        { id: "positive_ratings", name: "Ratings", type: "number"}
    ]
)

export const dataSources = [
    offersDataSource,
    locationDataSource,
    departmentsDataSource,
    candidatesDataSource
] satisfies RecruiteeDataSource[]

function createDataSource(
    {
        name,
        apiPath,
        fetch,
    }: {
        name: string
        apiPath: string
        fetch: (boardToken: string, companyId: string) => Promise<RecruiteeItem[]>
    },
    [idField, slugField, ...fields]: [RecruiteeField, RecruiteeField, ...RecruiteeField[]]
): RecruiteeDataSource {
    return {
        id: name,
        name,
        apiPath,
        fields: [idField, slugField, ...fields],
        fetch,
    }
}

/**
 * Remove Recruitee-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removeRecruiteeKeys(fields: RecruiteeField[]): ManagedCollectionFieldInput[] {
    return fields.map(originalField => {
        const field = { ...originalField }
        delete field.getValue
        return field
    })
}
