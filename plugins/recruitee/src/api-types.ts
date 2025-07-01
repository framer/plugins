export interface Offer {
    id: number
    title: string
    department: string | null
    employment_type: string
    status: string
    candidates_count: number
    hired_candidates_count: number
    disqualified_candidates_count: number
    location: string | null
    street: string | null
    city: string | null
    state_name: string | null
    postal_code: string | null
    country_code: string | null
    mailbox_email: string
    requirements: string
    description: string
    offer_tags: string
    url: string
    adminapp_url: string | null
    careers_url: string | null
    state_code: string | null
    kind: string | null
    shared_openings_count: number | null
    dynamic_fields_count: string | null
    has_active_campaign: boolean
    enabled_for_referrals: boolean
    number_of_openings: number | null
    highlight_html: string | null
    job_scheduler: string | null
    position: number | null
    lang_code: string | null
    eeo_settings: string | null
    hiring_manager_id: number | null
    pipeline_template_id: number | null
    priority: string | null
    on_site: boolean
    hybrid: boolean
    remote: boolean
    published_at: string | null
    closed_at: string | null
}
export interface Location {
    id: number
    name: string
    city: string
    is_valid: boolean
    country_code: string
    full_address: string
    lang_code: string | null
    postal_code: string | null
    street: string | null
    note: string | null
    state_name: string | null
    state_code: string | null
    created_at: string | null
    updated_at: string | null
}

export interface Department {
    id: number
    name: string
    status: string
    offers_count: number
    talent_pools_count: number
}

export interface Candidate {
    id: number
    initials: string | null
    name: string
    example: string | null
    emails: string
    phones: string
    photo_thumb_url: string | null
    positive_ratings: number
    has_avatar: boolean
    pending_result_request: boolean
    tasks_count: number
    my_upcoming_event: boolean
    followed: boolean
    upcoming_event: boolean
    rating_visible: boolean
    ratings_count: number
    unread_notifications: boolean
    is_revealed: boolean
    is_hired: boolean
    my_last_rating: string | null
    source: string | null
    last_message_at: string | null
    is_anonymous: boolean
    adminapp_url: string | null
    referrer: string | null
    created_at: string | null
    updated_at: string | null
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
        if (item.department != null && typeof item.department !== "string") {
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
        if (item.location != null && typeof item.location !== "string") {
            throw new Error("Expected candidates to have string location")
        }
        if (item.street != null && typeof item.street !== "string") {
            throw new Error("Expected candidates to have string street")
        }
        if (item.state_name != null && typeof item.state_name !== "string") {
            throw new Error("Expected candidates to have string state name")
        }
        if (item.postal_code != null && typeof item.postal_code !== "string") {
            throw new Error("Expected candidates to have string postal code")
        }
        if (item.country_code != null && typeof item.country_code !== "string") {
            throw new Error("Expected candidates to have string country code")
        }
        if (item.enabled_for_referrals != null && typeof item.enabled_for_referrals !== "boolean") {
            throw new Error("Expected candidates to have boolean enabled for referrals")
        }
        if (item.on_site != null && typeof item.on_site !== "boolean") {
            throw new Error("Expected candidates to have boolean on site")
        }
        if (item.remote != null && typeof item.remote !== "boolean") {
            throw new Error("Expected candidates to have boolean remote")
        }
        if (item.adminapp_url != null && typeof item.adminapp_url !== "string") {
            throw new Error("Expected candidates to have string adminapp url")
        }
        if (item.careers_url != null && typeof item.careers_url !== "string") {
            throw new Error("Expected candidates to have string careers url")
        }
        if (item.state_code != null && typeof item.state_code !== "string") {
            throw new Error("Expected candidates to have string state code")
        }
        if (item.kind != null && typeof item.kind !== "string") {
            throw new Error("Expected candidates to have string kind")
        }
        if (item.shared_openings_count != null && typeof item.shared_openings_count !== "number") {
            throw new Error("Expected candidates to have number shared openings count")
        }
        if (item.dynamic_fields_count != null && typeof item.dynamic_fields_count !== "number") {
            throw new Error("Expected candidates to have number dynamic fields count")
        }
        if (item.has_active_campaign != null && typeof item.has_active_campaign !== "boolean") {
            throw new Error("Expected candidates to have boolean has active campaign")
        }
        if (item.enabled_for_referrals != null && typeof item.enabled_for_referrals !== "boolean") {
            throw new Error("Expected candidates to have boolean enabled for referrals")
        }
        if (item.number_of_openings != null && typeof item.number_of_openings !== "number") {
            throw new Error("Expected candidates to have number number_of_openings")
        }
        if (item.highlight_html != null && typeof item.highlight_html !== "string") {
            throw new Error("Expected candidates to have string highlight_html")
        }
        if (item.job_scheduler != null && typeof item.job_scheduler !== "string") {
            throw new Error("Expected candidates to have string job_scheduler")
        }
        if (item.position != null && typeof item.position !== "number") {
            throw new Error("Expected candidates to have number position")
        }
        if (item.lang_code != null && typeof item.lang_code !== "string") {
            throw new Error("Expected candidates to have string lang_code")
        }
        if (item.eeo_settings != null && typeof item.eeo_settings !== "string") {
            throw new Error("Expected candidates to have string eeo_settings")
        }
        if (item.hiring_manager_id != null && typeof item.hiring_manager_id !== "number") {
            throw new Error("Expected candidates to have number hiring_manager_id")
        }
        if (item.pipeline_template_id != null && typeof item.pipeline_template_id !== "number") {
            throw new Error("Expected candidates to have number pipeline_template_id")
        }
        if (item.priority != null && typeof item.priority !== "string") {
            throw new Error("Expected candidates to have string priority")
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
        if (item.lang_code != null && typeof item.lang_code !== "string") {
            throw new Error("Expected candidates to have string lang_code")
        }
        if (item.postal_code != null && typeof item.postal_code !== "string") {
            throw new Error("Expected candidates to have string postal_code")
        }
        if (item.street != null && typeof item.street !== "string") {
            throw new Error("Expected candidates to have string street")
        }
        if (item.note != null && typeof item.note !== "string") {
            throw new Error("Expected candidates to have string note")
        }
        if (item.state_code != null && typeof item.state_code !== "string") {
            throw new Error("Expected candidates to have string state_code")
        }
        if (item.created_at != null && typeof item.created_at !== "string") {
            throw new Error("Expected candidates to have string created_at")
        }
        if (item.updated_at != null && typeof item.updated_at !== "string") {
            throw new Error("Expected candidates to have string updated_at")
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
        if (item.status != null && typeof item.status !== "string") {
            throw new Error("Expected department to have string status")
        }
        if (typeof item.offers_count !== "number") {
            throw new Error("Expected department to have number offer count")
        }
        if (typeof item.talent_pools_count !== "number") {
            throw new Error("Expected department to have number talent_pools_count")
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
        if (item.positive_ratings != null && typeof item.positive_ratings !== "number") {
            throw new Error("Expected candidates to have number positive rating")
        }
        if (item.photo_thumb_url != null && typeof item.photo_thumb_url !== "string") {
            throw new Error("Expected candidates to have string photo_thumb_url")
        }
        if (typeof item.has_avatar !== "boolean") {
            throw new Error("Expected candidates to have boolean has_avatar")
        }
        if (typeof item.pending_result_request !== "boolean") {
            throw new Error("Expected candidates to have boolean pending_result_request")
        }
        if (item.positive_ratings != null && typeof item.positive_ratings !== "number") {
            throw new Error("Expected candidates to have number positive rating")
        }
        if (item.tasks_count != null && typeof item.tasks_count !== "number") {
            throw new Error("Expected candidates to have number tasks_count")
        }
        if (typeof item.my_upcoming_event !== "boolean") {
            throw new Error("Expected candidates to have boolean my_upcoming_event")
        }
        if (typeof item.followed !== "boolean") {
            throw new Error("Expected candidates to have boolean followed")
        }
        if (typeof item.upcoming_event !== "boolean") {
            throw new Error("Expected candidates to have boolean upcoming_event")
        }
        if (typeof item.rating_visible !== "boolean") {
            throw new Error("Expected candidates to have boolean rating_visible")
        }
        if (item.ratings_count != null && typeof item.ratings_count !== "number") {
            throw new Error("Expected candidates to have number ratings_count")
        }
        if (typeof item.unread_notifications !== "boolean") {
            throw new Error("Expected candidates to have boolean unread_notifications")
        }
        if (typeof item.is_revealed !== "boolean") {
            throw new Error("Expected candidates to have boolean is_revealed")
        }
        if (typeof item.is_hired !== "boolean") {
            throw new Error("Expected candidates to have boolean is_hired")
        }
        if (item.my_last_rating != null && typeof item.my_last_rating !== "string") {
            throw new Error("Expected candidates to have string my_last_rating")
        }
        if (item.source != null && typeof item.source !== "string") {
            throw new Error("Expected candidates to have string source")
        }
        if (item.last_message_at != null && typeof item.last_message_at !== "string") {
            throw new Error("Expected candidates to have string last_message_at")
        }
        if (typeof item.is_anonymous !== "boolean") {
            throw new Error("Expected candidates to have boolean is_anonymous")
        }
        if (item.adminapp_url != null && typeof item.adminapp_url !== "string") {
            throw new Error("Expected candidates to have string adminapp_url")
        }
        if (item.referrer != null && typeof item.referrer !== "string") {
            throw new Error("Expected candidates to have string referrer")
        }
        if (item.created_at != null && typeof item.created_at !== "string") {
            throw new Error("Expected candidates to have string created_at")
        }
        if (item.updated_at != null && typeof item.updated_at !== "string") {
            throw new Error("Expected candidates to have string updated_at")
        }
    }
}