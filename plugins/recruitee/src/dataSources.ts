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
    fetch: (token: string, companyId: string) => Promise<RecruiteeItem[]>
}

async function fetchRecruiteeData(url: string, token: string): Promise<unknown> {
    try {
        const response = await fetch(url, {
            headers: new Headers({
                Authorization: "Bearer " + token,
            }),
        })
        return await response.json()
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

const locationsSchema = v.object({ locations: v.array(LocationSchema) })
const locationDataSource = createDataSource(
    {
        name: "Locations",
        fetch: async (token: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/locations`
            const items = v.safeParse(locationsSchema, await fetchRecruiteeData(url, token))
            if (!items.success) {
                console.log("Error parsing Recruitee data:", items.issues)
                throw new Error("Error parsing Recruitee data")
            }
            return items.output.locations
        },
    },
    [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "is_valid", name: "Is Valid", type: "boolean" },
        { id: "lang_code", name: "Language Code", type: "string" },
        { id: "city", name: "City", type: "string" },
        { id: "state_name", name: "State", type: "string" },
        { id: "state_code", name: "State Code", type: "string" },
        { id: "postal_code", name: "Postal Code", type: "string" },
        { id: "country_code", name: "Country", type: "string" },
        { id: "street", name: "Street", type: "string" },
        { id: "full_address", name: "Full Address", type: "string" },
        { id: "note", name: "Note", type: "string" },
        { id: "archived_at", name: "Archived At", type: "date" },
        { id: "created_at", name: "Created At", type: "date" },
        { id: "updated_at", name: "Updated At", type: "date" },
    ]
)

const offersSchema = v.object({ offers: v.array(OfferSchema) })
const offersDataSource = createDataSource(
    {
        name: "Offers",
        fetch: async (token: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/offers`

            const data = v.safeParse(offersSchema, await fetchRecruiteeData(url, token))

            if (!data.success) {
                console.log("Error parsing Recruitee data:", data.issues)
                throw new Error("Error parsing Recruitee data")
            }
            return data.output.offers
        },
    },
    [
        { id: "title", name: "Title", type: "string" },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "position", name: "Position", type: "number" },
        { id: "department", name: "Department Name", type: "string" },
        {
            id: "department_id",
            name: "Department",
            type: "collectionReference",
            collectionId: "",
            dataSourceId: "Departments",
        },
        { id: "employment_type", name: "Type", type: "string" },
        {
            id: "status",
            name: "Status",
            type: "enum",
            cases: [
                { id: "published", name: "Published" },
                { id: "internal", name: "Internal" },
                { id: "closed", name: "Closed" },
                { id: "archived", name: "Archived" },
            ],
        },
        { id: "candidates_count", name: "Candidates Count", type: "number" },
        { id: "qualified_candidates_count", name: "Qualified Candidates Count", type: "number" },
        {
            id: "hired_candidates_without_openings_count",
            name: "Hired Candidates Without Openings Count",
            type: "number",
        },
        { id: "shared_openings_count", name: "Shared Openings Count", type: "number" },
        { id: "dynamic_fields_count", name: "Dynamic Fields Count", type: "number" },
        {
            id: "hired_candidates_count",
            name: "Hired Candidates Count",
            type: "number",
        },
        {
            id: "disqualified_candidates_count",
            name: "Disqualified Candidates Count",
            type: "number",
        },
        { id: "city", name: "City", type: "string" },
        { id: "state_name", name: "State", type: "string" },
        { id: "state_code", name: "State Code", type: "string" },
        { id: "postal_code", name: "Postal Code", type: "string" },
        { id: "country_code", name: "Country Code", type: "string" },
        { id: "mailbox_email", name: "Email", type: "string" },
        { id: "requirements", name: "Requirements", type: "formattedText" },
        { id: "description", name: "Description", type: "formattedText" },
        {
            id: "tags",
            name: "Tags",
            type: "string",
            getValue: value => {
                const parsedTags = v.safeParse(v.array(v.object({ name: v.string() })), value ?? [])
                if (!parsedTags.success) {
                    return ""
                }

                return parsedTags.output.map(item => item.name).join(", ")
            },
        },
        { id: "url", name: "URL", type: "link" },
        { id: "adminapp_url", name: "Admin App URL", type: "link" },
        { id: "careers_url", name: "Careers URL", type: "link" },
        { id: "kind", name: "Kind", type: "string" },
        { id: "has_active_campaign", name: "Has Active Campaign", type: "boolean" },
        { id: "enabled_for_referrals", name: "Enabled For Referrals", type: "boolean" },
        { id: "number_of_openings", name: "Number of Openings", type: "number" },
        { id: "highlight_html", name: "Highlight HTML", type: "formattedText" },
        { id: "job_scheduler", name: "Job Scheduler", type: "string" },
        { id: "lang_code", name: "Language Code", type: "string" },
        { id: "hiring_manager_id", name: "Hiring Manager ID", type: "string" },
        { id: "on_site", name: "On Site", type: "boolean" },
        { id: "pipeline", name: "Pipeline", type: "boolean" },
        { id: "pipeline_template_id", name: "Pipeline Template ID", type: "string" },
        { id: "remote", name: "Remote", type: "boolean" },
        { id: "published_at", name: "Published At", type: "date" },
        { id: "closed_at", name: "Closed At", type: "date" },
        { id: "priority", name: "Priority", type: "string" },
        {
            id: "recruiter_id",
            name: "Recruiter ID",
            type: "string",
        },
        { id: "hybrid", name: "Hybrid", type: "boolean" },
        { id: "wysiwyg_editor", name: "WYSIWYG Editor", type: "string" },
        { id: "created_at", name: "Created At", type: "date" },
        { id: "updated_at", name: "Updated At", type: "date" },
        { id: "guid", name: "GUID", type: "string" },
        { id: "example", name: "Example", type: "boolean" },
        { id: "followed", name: "Followed", type: "boolean" },
        {
            id: "location",
            name: "Location",
            type: "string",
        },
        {
            id: "location_ids",
            name: "Locations",
            type: "multiCollectionReference",
            collectionId: "",
            dataSourceId: "Locations",
        },
    ]
)
const departmentsSchema = v.object({ departments: v.array(DepartmentSchema) })
const departmentsDataSource = createDataSource(
    {
        name: "Departments",
        fetch: async (token: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/departments`
            const data = v.safeParse(departmentsSchema, await fetchRecruiteeData(url, token))

            if (!data.success) {
                console.log("Error parsing Recruitee data:", data.issues)
                throw new Error("Error parsing Recruitee data")
            }
            return data.output.departments
        },
    },
    [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        {
            id: "status",
            name: "Status",
            type: "string",
        },
        { id: "offers_count", name: "Offers Count", type: "number" },
        { id: "talent_pools_count", name: "Talent Pools Count", type: "number" },
    ]
)

const candidatesSchema = v.object({ candidates: v.array(CandidateSchema) })
const candidatesDataSource = createDataSource(
    {
        name: "Candidates",
        fetch: async (token: string, companyId: string) => {
            const url = `https://api.recruitee.com/c/${companyId}/candidates`
            const data = v.safeParse(candidatesSchema, await fetchRecruiteeData(url, token))
            if (!data.success) {
                console.log("Error parsing Recruitee data:", data.issues)
                throw new Error("Error parsing Recruitee data")
            }
            return data.output.candidates
        },
    },
    [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "initials", name: "Initials", type: "string" },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "example", name: "Example", type: "boolean" },
        {
            id: "emails",
            name: "Emails",
            type: "string",
            getValue: value => {
                const list = v.parse(v.array(v.string()), value)
                return list.join(", ")
            },
        },
        { id: "invalid_emails", name: "Invalid Emails", type: "string" },
        {
            id: "phones",
            name: "Phone Numbers",
            type: "string",
            getValue: value => {
                const list = v.parse(v.array(v.string()), value)
                return list.join(", ")
            },
        },
        { id: "positive_ratings", name: "Ratings", type: "number" },
        { id: "photo_thumb_url", name: "Thumbnail Photo", type: "image" },
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
        { id: "last_message_at", name: "Last Message At", type: "date" },
        { id: "adminapp_url", name: "Admin App URL", type: "link" },
        { id: "admin_id", name: "Admin ID", type: "number" },
        { id: "is_anonymous", name: "Is Anonymous", type: "boolean" },
        { id: "referrer", name: "Referrer", type: "string" },
        { id: "created_at", name: "Created At", type: "date" },
        { id: "updated_at", name: "Updated At", type: "date" },
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
        fetch: (token: string, companyId: string) => Promise<RecruiteeItem[]>
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
