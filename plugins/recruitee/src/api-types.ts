import * as v from "valibot"
export const tagsSchema = v.object({
    id: v.number(),
    name: v.string(),
})

export const OfferSchema = v.object({
    id: v.number(),
    title: v.string(),
    department: v.optional(v.nullable(v.string())),
    department_id: v.optional(v.nullable(v.number())),
    employment_type: v.optional(v.nullable(v.string())),
    status: v.optional(v.nullable(v.string())),
    candidates_count: v.optional(v.nullable(v.number())),
    qualified_candidates_count: v.optional(v.nullable(v.number())),
    hired_candidates_count: v.optional(v.nullable(v.number())),
    hired_candidates_without_openings_count: v.optional(v.nullable(v.number())),
    disqualified_candidates_count: v.optional(v.nullable(v.number())),
    street: v.optional(v.nullable(v.string())),
    city: v.optional(v.nullable(v.string())),
    state_name: v.optional(v.nullable(v.string())),
    postal_code: v.optional(v.nullable(v.string())),
    country_code: v.optional(v.nullable(v.string())),
    mailbox_email: v.optional(v.nullable(v.string())),
    requirements: v.optional(v.nullable(v.string())),
    description: v.optional(v.nullable(v.string())),
    tags: v.optional(v.nullable(v.array(tagsSchema))),
    url: v.optional(v.nullable(v.string())),
    slug: v.string(),
    adminapp_url: v.optional(v.nullable(v.string())),
    careers_url: v.optional(v.nullable(v.string())),
    state_code: v.optional(v.nullable(v.string())),
    kind: v.optional(v.nullable(v.string())),
    shared_openings_count: v.optional(v.nullable(v.number())),
    dynamic_fields_count: v.optional(v.nullable(v.number())),
    has_active_campaign: v.optional(v.nullable(v.boolean())),
    enabled_for_referrals: v.optional(v.nullable(v.boolean())),
    number_of_openings: v.optional(v.nullable(v.number())),
    highlight_html: v.optional(v.nullable(v.string())),
    job_scheduler: v.optional(v.nullable(v.string())),
    position: v.optional(v.nullable(v.number())),
    lang_code: v.optional(v.nullable(v.string())),
    hiring_manager_id: v.optional(v.nullable(v.number())),
    recruiter_id: v.optional(v.nullable(v.number())),
    pipeline_template_id: v.optional(v.nullable(v.number())),
    pipeline: v.optional(v.nullable(v.boolean())),
    priority: v.optional(v.nullable(v.string())),
    on_site: v.optional(v.nullable(v.boolean())),
    hybrid: v.optional(v.nullable(v.boolean())),
    remote: v.optional(v.nullable(v.boolean())),
    published_at: v.optional(v.nullable(v.string())),
    closed_at: v.optional(v.nullable(v.string())),
    created_at: v.optional(v.nullable(v.string())),
    updated_at: v.optional(v.nullable(v.string())),
    guid: v.string(),
    example: v.optional(v.nullable(v.boolean())),
    followed: v.optional(v.nullable(v.boolean())),
    wysiwyg_editor: v.optional(v.nullable(v.string())),
    location: v.optional(v.nullable(v.string())),
    location_ids: v.optional(v.nullable(v.array(v.number()))),
})
export const LocationSchema = v.object({
    id: v.number(),
    name: v.string(),
    city: v.string(),
    is_valid: v.boolean(),
    country_code: v.string(),
    full_address: v.nullable(v.string()),
    lang_code: v.nullable(v.string()),
    postal_code: v.nullable(v.string()),
    street: v.nullable(v.string()),
    note: v.nullable(v.string()),
    state_name: v.nullable(v.string()),
    state_code: v.nullable(v.string()),
    archived_at: v.nullable(v.string()),
    created_at: v.nullable(v.string()),
    updated_at: v.nullable(v.string()),
})

export type Location = v.InferOutput<typeof LocationSchema>

export type Offer = v.InferOutput<typeof OfferSchema>

export const DepartmentSchema = v.object({
    id: v.number(),
    name: v.string(),
    status: v.nullable(v.string()),
    offers_count: v.nullable(v.number()),
    talent_pools_count: v.nullable(v.number()),
})

export type Department = v.InferOutput<typeof DepartmentSchema>
export const CandidateSchema = v.object({
    id: v.number(),
    initials: v.nullable(v.string()),
    name: v.string(),
    example: v.boolean(),
    emails: v.array(v.nullable(v.string())),
    phones: v.array(v.string()),
    photo_thumb_url: v.nullable(v.string()),
    positive_ratings: v.nullable(v.number()),
    has_avatar: v.boolean(),
    pending_result_request: v.boolean(),
    my_pending_result_request: v.boolean(),
    tasks_count: v.nullable(v.number()),
    my_upcoming_event: v.boolean(),
    followed: v.boolean(),
    viewed: v.boolean(),
    upcoming_event: v.boolean(),
    rating_visible: v.boolean(),
    ratings_count: v.number(),
    unread_notifications: v.boolean(),
    is_revealed: v.boolean(),
    is_hired: v.boolean(),
    my_last_rating: v.nullable(v.string()),
    source: v.nullable(v.string()),
    last_message_at: v.nullable(v.string()),
    is_anonymous: v.boolean(),
    adminapp_url: v.nullable(v.string()),
    admin_id: v.nullable(v.number()),
    referrer: v.nullable(v.string()),
    created_at: v.nullable(v.string()),
    updated_at: v.nullable(v.string()),
})

export type Candidate = v.InferOutput<typeof CandidateSchema>

export type RecruiteeItem = Offer | Location | Department | Candidate

export function hasOwnProperty<T extends object, Key extends PropertyKey>(
    object: T,
    key: Key
): object is T & Record<Key, unknown> {
    return Object.hasOwn(object, key)
}
