import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import { CandidateSchema, DepartmentSchema, LocationSchema, OfferSchema, type RecruiteeItem } from "./api-types"

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
    fetch: (boardToken: string, companyId: string) => Promise<RecruiteeItem[]>
}

async function fetchRecruiteeData(url: string, boardToken: string): Promise<unknown[]> {
    try {
        const response = await fetch(url, {
            headers: new Headers({
                Authorization: "Bearer " + boardToken,
            }),
        })
        const items = []
        items.push((await response.json()) as unknown)
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

const locationsSchema = v.array(v.object({ locations: v.array(LocationSchema) }))
const locationDataSource = createDataSource(
    {
        name: "Locations",
        fetch: async (boardToken: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/locations`
            const items = v.parse(locationsSchema, await fetchRecruiteeData(url, boardToken))
            return items.flatMap(page => page.locations)
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "is_valid", name: "Is Valid", type: "boolean" },
        { id: "lang_code", name: "Lang Code", type: "string" },
        { id: "city", name: "City", type: "string" },
        { id: "state_name", name: "State", type: "string" },
        { id: "state_code", name: "State Code", type: "string" },
        { id: "postal_code", name: "Postal Code", type: "string" },
        { id: "country_code", name: "Country", type: "string" },
        { id: "street", name: "Street", type: "string" },
        { id: "full_address", name: "Full Address", type: "string" },
        { id: "note", name: "Note", type: "string" },
        { id: "archived_at", name: "Archived At", type: "string" },
        { id: "created_at", name: "Created At", type: "string" },
        { id: "updated_at", name: "Updated At", type: "string" },
    ]
)

const offersSchema = v.array(v.object({ offers: v.array(OfferSchema) }))
const offersDataSource = createDataSource(
    {
        name: "Offers",
        fetch: async (boardToken: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/offers`
            const items = v.parse(offersSchema, await fetchRecruiteeData(url, boardToken))
            return items.flatMap(page => page.offers)
        },
    },
    [
        { id: "slug", name: "Slug", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "position", name: "Position", type: "number" },
        { id: "department", name: "Department", type: "string" },
        { id: "department_id", name: "Department ID", type: "string" },
        { id: "employment_type", name: "Type", type: "string" },
        { id: "status", name: "Status", type: "string" },
        { id: "candidates_count", name: "Candidates Count", type: "number" },
        { id: "hired_candidates_count", name: "Hired Candidates Count", type: "number" },
        { id: "disqualified_candidates_count", name: "Disqualified Candidates Count", type: "number" },
        { id: "location", name: "Location", type: "string" },
        { id: "street", name: "Street", type: "string" },
        { id: "city", name: "City", type: "string" },
        { id: "state_name", name: "State", type: "string" },
        { id: "state_code", name: "State Code", type: "string" },
        { id: "postal_code", name: "Postal Code", type: "string" },
        { id: "country_code", name: "Country Code", type: "string" },
        { id: "mailbox_email", name: "Email", type: "string" },
        { id: "requirements", name: "Requirements", type: "formattedText" },
        { id: "description", name: "Description", type: "formattedText" },
        { id: "offer_tags", name: "Offer Tags", type: "string" },
        { id: "tags", name: "Tags", type: "string" },
        { id: "url", name: "Url", type: "link" },
        { id: "adminapp_url", name: "Adminapp Url", type: "link" },
        { id: "careers_url", name: "Careers Url", type: "link" },
        { id: "kind", name: "Kind", type: "string" },
        { id: "has_active_campaign", name: "Has Active Campaign", type: "boolean" },
        { id: "enabled_for_referrals", name: "Enabled For Referrals", type: "boolean" },
        { id: "number_of_openings", name: "Number Of Openings", type: "number" },
        { id: "highlight_html", name: "Highlight Html", type: "formattedText" },
        { id: "job_scheduler", name: "Job Scheduler", type: "string" },
        { id: "lang_code", name: "Lang Code", type: "string" },
        // { id: "eeo_settings", name: "Eeo Settings", type: "string" },
        { id: "hiring_manager_id", name: "Hiring Manager Id", type: "string" },
        { id: "on_site", name: "Is On Site", type: "boolean" },
        { id: "pipeline", name: "Is Pipeline", type: "boolean" },
        { id: "pipeline_template_id", name: "Pipeline Template Id", type: "string" },
        { id: "remote", name: "Is Remote", type: "boolean" },
        { id: "published_at", name: "Published At", type: "string" },
        { id: "closed_at", name: "Closed At", type: "string" },
        { id: "priority", name: "Priority", type: "string" },
        {
            id: "recruiter_id",
            name: "Recruiter",
            type: "string",
        },
        { id: "hybrid", name: "Is Hybrid", type: "boolean" },
        { id: "wysiwyg_editor", name: "Wysiwyg Editor", type: "string" },
        { id: "created_at", name: "Created At", type: "string" },
        { id: "updated_at", name: "Updated At", type: "string" },
        { id: "guid", name: "Guid", type: "string" },
        { id: "example", name: "Example", type: "boolean" },
        { id: "followed", name: "Followed", type: "boolean" },
        {
            id: "location_ids",
            name: "Locations",
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: locationDataSource.name,
        },
    ]
)
const departmentsSchema = v.array(v.object({ departments: v.array(DepartmentSchema) }))
const departmentsDataSource = createDataSource(
    {
        name: "Departments",
        fetch: async (boardToken: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/departments`
            const items = v.parse(departmentsSchema, await fetchRecruiteeData(url, boardToken))
            return items.flatMap(page => page.departments)
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "status", name: "Status", type: "string" },
        { id: "offers_count", name: "Offers Count", type: "number" },
        { id: "talent_pools_count", name: "Talent Pools Count", type: "number" },
    ]
)

const candidatesSchema = v.array(v.object({ candidates: v.array(CandidateSchema) }))
const candidatesDataSource = createDataSource(
    {
        name: "Candidates",
        fetch: async (boardToken: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/candidates`
            const items = v.parse(candidatesSchema, await fetchRecruiteeData(url, boardToken))
            return items.flatMap(page => page.candidates)
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "initials", name: "Initials", type: "string" },
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "example", name: "Example", type: "boolean" },
        {
            id: "emails",
            name: "Emails",
            type: "string",
            getValue: value => {
                if (typeof value === "object" && value !== null) {
                    return Object.entries(value)
                        .map(([, val]) => `${val}`)
                        .join(", ")
                }
                return null
            },
        },
        { id: "invalid_emails", name: "Invalid Emails", type: "string" },
        {
            id: "phones",
            name: "Phones",
            type: "string",
            getValue: value => {
                if (typeof value === "object" && value !== null) {
                    return Object.entries(value)
                        .map(([, val]) => `${val}`)
                        .join(", ")
                }
                return null
            },
        },

        { id: "positive_ratings", name: "Ratings", type: "number" },
        { id: "photo_thumb_url", name: "Photo Thumb Url", type: "string" },
        { id: "has_avatar", name: "Has Avatar", type: "boolean" },
        { id: "pending_result_request", name: "Pending Result Request", type: "boolean" },
        { id: "tasks_count", name: "Tasks Count", type: "number" },
        { id: "my_upcoming_event", name: "My Upcoming Event", type: "boolean" },
        { id: "followed", name: "Followed", type: "boolean" },
        { id: "viewed", name: "Viewed", type: "boolean" },
        { id: "my_pending_result_request", name: "My Pending Result Request", type: "boolean" },
        { id: "upcoming_event", name: "Upcoming Event", type: "boolean" },
        { id: "rating_visible", name: "Rating Visible", type: "boolean" },
        { id: "ratings_count", name: "Ratings Count", type: "number" },
        { id: "unread_notifications", name: "Unread Notifications", type: "boolean" },
        { id: "is_revealed", name: "Is Revealed", type: "boolean" },
        { id: "is_hired", name: "Is Hired", type: "boolean" },
        { id: "my_last_rating", name: "My Last Rating", type: "string" },
        { id: "source", name: "Source", type: "string" },
        { id: "last_message_at", name: "Last Message At", type: "string" },
        { id: "adminapp_url", name: "Admin App Url", type: "string" },
        { id: "admin_id", name: "Admin Id", type: "number" },
        { id: "is_anonymous", name: "Is Anonymous", type: "boolean" },
        { id: "referrer", name: "Referrer", type: "string" },
        { id: "created_at", name: "Created At", type: "string" },
        { id: "updated_at", name: "Updated At", type: "string" },
    ]
)

export const dataSources = [
    offersDataSource,
    locationDataSource,
    departmentsDataSource,
    candidatesDataSource,
] satisfies RecruiteeDataSource[]

function createDataSource(
    {
        name,
        fetch,
    }: {
        name: string
        fetch: (boardToken: string, companyId: string) => Promise<RecruiteeItem[]>
    },
    [idField, slugField, ...fields]: [RecruiteeField, RecruiteeField, ...RecruiteeField[]]
): RecruiteeDataSource {
    return {
        id: name,
        name,
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
        const { getValue, ...field } = originalField
        return field
    })
}
