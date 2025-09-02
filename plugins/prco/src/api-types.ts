import * as v from "valibot"
export const FeaturedImagesForClSchema = v.object({
    url: v.optional(v.nullable(v.string())),
    width: v.optional(v.nullable(v.union([v.number(), v.string()]))),
    height: v.optional(v.nullable(v.union([v.number(), v.string()]))),
})

export const AlexaSchema = v.nullable(
    v.object({
        overall_rank: v.optional(v.nullable(v.number())),
        country_rank: v.optional(v.nullable(v.union([v.number(), v.string()]))),
        country_rank_code: v.optional(v.nullable(v.string())),
    })
)

export const ImageSizesSchema = v.object({
    medium: v.optional(FeaturedImagesForClSchema),
    original: v.optional(FeaturedImagesForClSchema),
    large: v.optional(FeaturedImagesForClSchema),
    square: v.optional(FeaturedImagesForClSchema),
    small: v.optional(FeaturedImagesForClSchema),
    thumbnail: v.optional(FeaturedImagesForClSchema),
})

export const SocialSchema = v.object({
    facebook: v.nullable(v.number()),
    linkedin: v.nullable(v.number()),
    twitter: v.nullable(v.number()),
})

export const ClippingImageSchema = v.object({
    small: v.nullable(v.string()),
    medium: v.nullable(v.string()),
    large: v.nullable(v.string()),
})
export const ClippingImageAsImageSchema = v.pipe(
    ClippingImageSchema,
    v.transform(obj => obj.small ?? obj.medium ?? obj.large)
)

export const FeaturedImagesForClSchemaAsImage = v.pipe(
    v.array(FeaturedImagesForClSchema),
    v.transform(arr => arr[0]?.url ?? null)
)

export const TagsSchema = v.object({
    id: v.optional(v.string()),
    slug: v.nullable(v.string()),
    pressroom_id: v.optional(v.number()),
    name: v.nullable(v.string()),
    description: v.nullable(v.string()),
    layout: v.nullable(v.string()),
    image: v.optional(ImageSizesSchema),
    hero_image: v.optional(ImageSizesSchema),
})
export type Tags = v.InferOutput<typeof TagsSchema>

export const MediaInfoSchema = v.object({
    id: v.nullable(v.number()),
    pressroom_id: v.optional(v.number()),
    title: v.nullable(v.string()),
    permalink: v.nullable(v.string()),
    type: v.nullable(v.string()),
    content_type: v.nullable(v.string()),
    transparent: v.optional(v.nullable(v.boolean())),
    file_size: v.nullable(v.number()),
    url: v.optional(v.string()),
    webm_url: v.optional(v.string()),
    thumbnail_url: v.optional(v.string()),
    has_thumb: v.optional(v.boolean()),
    mp4_url: v.optional(v.string()),
    mp4_1080p_url: v.optional(v.string()),
    thumbnail_1080p_url: v.optional(v.string()),
    sizes: v.optional(v.nullable(ImageSizesSchema)),
})
export type MediaInfo = v.InferOutput<typeof MediaInfoSchema>

export const PressReleasesSchema = v.object({
    id: v.number(),
    pressroom_id: v.number(),
    title: v.string(),
    subtitle: v.nullable(v.string()),
    release_date: v.nullable(v.string()),
    release_location: v.nullable(v.string()),
    language: v.nullable(v.string()),
    social_media_pitch: v.nullable(v.string()),
    summary: v.nullable(v.string()),
    tags: v.array(TagsSchema),
    featured_images: v.array(MediaInfoSchema),
    body_html: v.nullable(v.string()),
    permalink: v.nullable(v.string()),
    full_url: v.nullable(v.string()),
    type: v.nullable(v.string()),
    state: v.nullable(v.string()),
    pdf: v.nullable(v.string()),
    show_in_timeline: v.nullable(v.boolean()),
    show_boilerplate_text: v.nullable(v.boolean()),
    freeform_two: v.nullable(v.boolean()),
    reading_time: v.nullable(v.union([v.number(), v.string()])),
    updated_at: v.nullable(v.string()),
})

export type PressReleases = v.InferOutput<typeof PressReleasesSchema>

export const ClippingsSchema = v.object({
    id: v.number(),
    state: v.nullable(v.string()),
    pressroom_id: v.number(),
    press_release_id: v.nullable(v.string()),
    title: v.string(),
    description: v.nullable(v.string()),
    featured_images: v.array(FeaturedImagesForClSchema),
    source: v.nullable(v.union([v.number(), v.string()])),
    url: v.nullable(v.string()),
    release_date: v.nullable(v.string()),
    shares: v.nullable(SocialSchema),
    sizes: v.nullable(ImageSizesSchema),
    alexa: v.nullable(AlexaSchema),
    private: v.nullable(v.boolean()),
    permalink: v.nullable(v.string()),
    type: v.nullable(v.string()),
    show_iframe: v.nullable(v.boolean()),
    language: v.nullable(v.string()),
    clipping_image: v.nullable(ClippingImageSchema),
    published_at: v.nullable(v.string()),
})
export type Clippings = v.InferOutput<typeof ClippingsSchema>

export const MediaKitsSchema = v.object({
    id: v.nullable(v.number()),
    title: v.nullable(v.string()),
    description_title: v.nullable(v.string()),
    description: v.nullable(v.string()),
    category_id: v.nullable(v.number()),
    media_count: v.nullable(v.number()),
    total_size: v.nullable(v.number()),
    is_locked: v.nullable(v.boolean()),
    is_password_protected: v.nullable(v.boolean()),
    media: v.array(MediaInfoSchema),
})
export type MediaKits = v.InferOutput<typeof MediaKitsSchema>

export type PrCoItem = PressReleases | Clippings | MediaKits | MediaInfo | Tags

export function hasOwnProperty<T extends object, Key extends PropertyKey>(
    object: T,
    key: Key
): object is T & Record<Key, unknown> {
    return Object.hasOwn(object, key)
}
