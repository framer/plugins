import * as v from "valibot"
export const tagsSchema = v.object({
    id: v.number(),
    name: v.string(),
})

export const OfferLeafSchema = v.object({
    id: v.number(),
    title: v.string(),
    department: v.nullable(v.string()),
    department_id: v.nullable(v.number()),
    employment_type: v.string(),
    status: v.string(),
    candidates_count: v.number(),
    qualified_candidates_count: v.number(),
    hired_candidates_count: v.number(),
    hired_candidates_without_openings_count: v.nullable(v.number()),
    disqualified_candidates_count: v.number(),
    street: v.nullable(v.string()),
    city: v.nullable(v.string()),
    state_name: v.nullable(v.string()),
    postal_code: v.nullable(v.string()),
    country_code: v.nullable(v.string()),
    mailbox_email: v.nullable(v.string()),
    requirements: v.nullable(v.string()),
    description: v.nullable(v.string()),
    tags: v.array(tagsSchema),
    url: v.nullable(v.string()),
    slug: v.string(),
    adminapp_url: v.nullable(v.string()),
    careers_url: v.nullable(v.string()),
    state_code: v.nullable(v.string()),
    kind: v.nullable(v.string()),
    shared_openings_count: v.nullable(v.number()),
    dynamic_fields_count: v.nullable(v.number()),
    has_active_campaign: v.boolean(),
    enabled_for_referrals: v.boolean(),
    number_of_openings: v.nullable(v.number()),
    highlight_html: v.nullable(v.string()),
    job_scheduler: v.nullable(v.string()),
    position: v.nullable(v.number()),
    lang_code: v.nullable(v.string()),
    hiring_manager_id: v.nullable(v.number()),
    recruiter_id: v.nullable(v.number()),
    pipeline_template_id: v.nullable(v.number()),
    pipeline: v.boolean(),
    priority: v.nullable(v.string()),
    on_site: v.boolean(),
    hybrid: v.boolean(),
    remote: v.boolean(),
    published_at: v.nullable(v.string()),
    closed_at: v.nullable(v.string()),
    created_at: v.nullable(v.string()),
    updated_at: v.nullable(v.string()),
    guid: v.string(),
    example: v.boolean(),
    followed: v.boolean(),
    wysiwyg_editor: v.nullable(v.string()),
    location: v.nullable(v.string()),
    location_ids: v.array(v.number()),
})
export const LocationLeafSchema = v.object({
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
export const LocationSchema = v.object({
    ...LocationLeafSchema.entries,
})

export type Location = v.InferOutput<typeof LocationSchema>

export const OfferSchema = v.object({
    ...OfferLeafSchema.entries,
})
export type Offer = v.InferOutput<typeof OfferSchema>

export const DepartmentLeafSchema = v.object({
    id: v.number(),
    name: v.string(),
    status: v.nullable(v.string()),
    offers_count: v.nullable(v.number()),
    talent_pools_count: v.nullable(v.number()),
})

export const DepartmentSchema = v.object({
    ...DepartmentLeafSchema.entries,
})

export type Department = v.InferOutput<typeof DepartmentSchema>
export const CandidateLeafSchema = v.object({
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

export const CandidateSchema = v.object({
    ...CandidateLeafSchema.entries,
})

export type Candidate = v.InferOutput<typeof CandidateSchema>

export type RecruiteeItem = Offer | Location | Department | Candidate

export function hasOwnProperty<T extends object, Key extends PropertyKey>(
    object: T,
    key: Key
): object is T & Record<Key, unknown> {
    return Object.hasOwn(object, key)
}
