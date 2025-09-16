import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import {
    AlexaSchema,
    ClippingImageAsImageSchema,
    ClippingsSchema,
    FeaturedImagesForClSchema,
    ImageSizesSchema,
    MediaInfoSchema,
    MediaKitsSchema,
    type PrCoItem,
    PressReleasesSchema,
    SocialSchema,
    TagsSchema,
} from "./api-types"

const API_URL = "https://api.pr.co/v1"

export interface PrcoDataSource {
    id: string
    name: string
    /**
     * The fields of the data source.
     *
     * The first field is the ID field.
     * The rest of the fields are the fields of the data source.
     */
    fields: readonly PrCoField[]
    fetch: (pressRoomId: string) => Promise<PrCoItem[]>
}

async function fetchPrCoData(url: string): Promise<unknown> {
    try {
        const response = await fetch(url)
        return await response.json()
    } catch (error) {
        console.error("Error fetching PrCo data:", error)
        throw error
    }
}

export type PrCoField = ManagedCollectionFieldInput & {
    key?: string
    /** Used to transform the value of the field. Sometimes the value is inside an object, so we need to extract it. */
    getValue?: (value: unknown) => unknown
} & (
        | {
              type: Exclude<ManagedCollectionFieldInput["type"], "collectionReference" | "multiCollectionReference">
              canBeUsedAsSlug?: boolean
          }
        | {
              type: "collectionReference" | "multiCollectionReference"
              dataSourceId: string
              supportedCollections?: { id: string; name: string }[]
          }
    )

const TagSchema = v.object({ data: v.array(TagsSchema) })
const TagDataSource = createDataSource(
    {
        name: "Tags",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/tags.json?limit=9999`
            const data = v.safeParse(TagSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }

            const dataWithId = data.output.data.map((tag, index) => ({
                ...tag,
                id: tag.slug ?? String(index),
            }))

            return dataWithId
        },
    },
    [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "pressroom_id", name: "Press Room ID", type: "string" },
        { id: "description", name: "Description", type: "string" },
        {
            id: "image",
            name: "Image",
            type: "image",
            getValue: value => {
                const parsed = v.parse(ImageSizesSchema, value)
                return parsed.original?.url ?? parsed.large?.url ?? parsed.medium?.url ?? parsed.small?.url
            },
        },
        {
            id: "hero_image",
            name: "Hero Image",
            type: "image",
            getValue: value => {
                const parsed = v.parse(ImageSizesSchema, value)
                return parsed.original?.url ?? parsed.large?.url ?? parsed.medium?.url ?? parsed.small?.url
            },
        },
    ]
)

const ClippingSchema = v.object({ data: v.array(ClippingsSchema) })
const ClippingDataSource = createDataSource(
    {
        name: "Clippings",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/clippings.json?limit=9999`
            const data = v.safeParse(ClippingSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }
            return data.output.data
        },
    },
    [
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "pressroom_id", name: "Press Room ID", type: "string" },
        { id: "press_release_id", name: "Press Release ID", type: "string" },
        { id: "state", name: "State", type: "string" },
        { id: "description", name: "Description", type: "string" },
        { id: "release_date", name: "Release Date", type: "date" },
        { id: "source", name: "Source", type: "string" },
        { id: "url", name: "URL", type: "link" },

        { id: "language", name: "Language", type: "string" },
        {
            id: "facebook_shares",
            key: "shares",
            name: "Facebook Shares",
            type: "number",
            getValue: value => {
                const shares = v.parse(SocialSchema, value)
                return shares.facebook
            },
        },
        {
            id: "linkedin_shares",
            key: "shares",
            name: "LinkedIn Shares",
            type: "number",
            getValue: value => {
                const shares = v.parse(SocialSchema, value)
                return shares.linkedin
            },
        },
        {
            id: "twitter_shares",
            key: "shares",
            name: "X (Twitter) Shares",
            type: "number",
            getValue: value => {
                const shares = v.parse(SocialSchema, value)
                return shares.twitter
            },
        },
        {
            id: "featured_images",
            name: "Featured Images",
            type: "array",
            fields: [
                {
                    id: "featured_images_image",
                    name: "Image",
                    type: "image",
                },
            ],
            getValue: value => {
                const parsed = v.parse(v.array(FeaturedImagesForClSchema), value)
                return parsed.map(item => item.url).filter(v => v)
            },
        },
        {
            id: "clipping_image",
            name: "Clipping Image",
            type: "image",
            getValue: value => {
                return v.parse(ClippingImageAsImageSchema, value)
            },
        },
        {
            id: "sizes",
            name: "Image",
            type: "image",
            getValue: value => {
                const parsed = v.parse(ImageSizesSchema, value)
                return parsed.original?.url ?? parsed.thumbnail?.url
            },
        },
        {
            id: "alexa_overall_rank",
            key: "alexa",
            name: "Alexa Overall Rank",
            type: "number",
            getValue: value => {
                const alexa = v.parse(AlexaSchema, value)
                return alexa?.overall_rank
            },
        },
        {
            id: "alexa_country_rank",
            key: "alexa",
            name: "Alexa Country Rank",
            type: "number",
            getValue: value => {
                const alexa = v.parse(AlexaSchema, value)
                return alexa?.country_rank
            },
        },
        {
            id: "alexa_country_rank_code",
            key: "alexa",
            name: "Alexa Country Rank Code",
            type: "string",
            getValue: value => {
                const alexa = v.parse(AlexaSchema, value)
                return alexa?.country_rank_code
            },
        },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "private", name: "Private", type: "boolean" },
        { id: "show_iframe", name: "Show iFrame", type: "boolean" },
        { id: "published_at", name: "Published At", type: "date" },
    ]
)

const MediaSchema = v.object({ data: v.array(MediaInfoSchema) })

const ImageDataSource = createDataSource(
    {
        name: "Images",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/images.json?limit=9999`
            const data = v.safeParse(MediaSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }
            return data.output.data
        },
    },
    [
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "pressroom_id", name: "Press Room ID", type: "string" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "transparent", name: "Transparent", type: "boolean" },
        { id: "file_size", name: "File Size", type: "number" },
        {
            id: "sizes",
            name: "Image",
            type: "image",
            getValue: value => {
                const parsed = v.parse(ImageSizesSchema, value)
                return parsed.original?.url ?? parsed.large?.url ?? parsed.medium?.url ?? parsed.square?.url
            },
        },
    ]
)

const MovieDataSource = createDataSource(
    {
        name: "Movies",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/movies.json?limit=9999`
            const data = v.safeParse(MediaSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }
            return data.output.data
        },
    },
    [
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "pressroom_id", name: "Press Room ID", type: "string" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "file_size", name: "File Size", type: "number" },
        { id: "url", name: "URL", type: "link" },
        { id: "webm_url", name: "WebM URL", type: "link" },
        { id: "mp4_url", name: "MP4 URL", type: "link" },
        { id: "mp4_1080p_url", name: "MP4 1080P URL", type: "link" },
        { id: "thumbnail_url", name: "Thumbnail", type: "image" },
    ]
)

const DocumentsDataSource = createDataSource(
    {
        name: "Documents",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/documents.json?limit=9999`
            const data = v.safeParse(MediaSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }
            return data.output.data
        },
    },
    [
        { id: "title", name: "Title", type: "string" },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "has_thumb", name: "Has Thumbnail", type: "boolean" },
        { id: "file_size", name: "File Size", type: "number" },
        { id: "url", name: "URL", type: "link" },
        {
            id: "sizes",
            name: "Image",
            type: "image",
            getValue: value => {
                const parsed = v.parse(v.nullable(ImageSizesSchema), value)
                return parsed?.original?.url ?? parsed?.large?.url ?? parsed?.medium?.url ?? parsed?.square?.url
            },
        },
    ]
)
const MediaKitSchema = v.object({ data: v.array(MediaKitsSchema) })
const MediaKitDataSource = createDataSource(
    {
        name: "Media Kits",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/media_kits.json?limit=9999`
            const data = v.safeParse(MediaKitSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }
            return data.output.data
        },
    },
    [
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "description_title", name: "Description Title", type: "string" },
        { id: "description", name: "Description", type: "string" },
        { id: "category_id", name: "Category ID", type: "number" },
        { id: "media_count", name: "Media Count", type: "number" },
        { id: "total_size", name: "Total Size", type: "number" },
        { id: "is_locked", name: "Is Locked", type: "boolean" },
        { id: "is_password_protected", name: "Is Password Protected", type: "boolean" },
        {
            key: "media",
            id: "images",
            name: "Images",
            type: "multiCollectionReference",
            dataSourceId: ImageDataSource.name,
            collectionId: "",
            getValue: value => {
                const parsed = v.parse(v.array(MediaInfoSchema), value)
                return parsed.filter(item => item.type === "image").map(item => item.id)
            },
        },
        {
            key: "media",
            id: "movies",
            name: "Movies",
            type: "multiCollectionReference",
            dataSourceId: MovieDataSource.name,
            collectionId: "",
            getValue: value => {
                const parsed = v.parse(v.array(MediaInfoSchema), value)
                return parsed.filter(item => item.type === "movie").map(item => item.id)
            },
        },
    ]
)

const PressReleaseSchema = v.object({ data: v.array(PressReleasesSchema) })
const PressReleaseDataSource = createDataSource(
    {
        name: "Press Releases",
        fetch: async (pressRoomId: string) => {
            const url = `${API_URL}/pressrooms/${pressRoomId}/press_releases.json?includes=featured_images,tags&limit=9999`
            const data = v.safeParse(PressReleaseSchema, await fetchPrCoData(url))

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }
            return data.output.data
        },
    },

    [
        { id: "title", name: "Title", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "ID", type: "string", canBeUsedAsSlug: true },
        { id: "pressroom_id", name: "Press Room ID", type: "string" },
        { id: "subtitle", name: "Subtitle", type: "string" },
        { id: "release_date", name: "Release Date", type: "date" },
        { id: "release_location", name: "Release Location", type: "string" },
        { id: "language", name: "Language", type: "string" },
        { id: "social_media_pitch", name: "Social Media Pitch", type: "string" }, // no API documentation, assume it's a string
        {
            id: "tags",
            name: TagDataSource.name,
            type: "multiCollectionReference",
            dataSourceId: TagDataSource.name,
            collectionId: "",
            getValue: value => {
                const parsed = v.parse(v.array(TagsSchema), value)
                return parsed.map(item => item.slug)
            },
        },
        {
            id: "featured_images",
            name: "Featured Images",
            type: "multiCollectionReference",
            dataSourceId: ImageDataSource.name,
            collectionId: "",
            getValue: value => {
                const parsed = v.parse(v.array(MediaInfoSchema), value)
                return parsed.map(item => item.id)
            },
        },
        {
            id: "summary",
            name: "Summary",
            type: "formattedText",
            getValue: value => {
                const parsed = v.parse(v.string(), value)
                return parsed.replaceAll("<p></p>", "")
            },
        },
        {
            id: "body_html",
            name: "Body",
            type: "formattedText",
            getValue: value => {
                const parsed = v.parse(v.string(), value)
                return parsed.replaceAll("<p></p>", "")
            },
        },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "full_url", name: "Full URL", type: "link" },
        { id: "pdf", name: "PDF", type: "link" },
        { id: "show_in_timeline", name: "Show In Timeline", type: "boolean" },
        { id: "show_boilerplate_text", name: "Show Boilerplate Text", type: "boolean" },
        { id: "freeform_two", name: "Freeform", type: "boolean" },
        { id: "reading_time", name: "Reading Time", type: "number" },
        { id: "updated_at", name: "Updated At", type: "date" },
    ]
)

export const dataSources = [
    PressReleaseDataSource,
    ClippingDataSource,
    MediaKitDataSource,
    ImageDataSource,
    MovieDataSource,
    DocumentsDataSource,
    TagDataSource,
] satisfies PrcoDataSource[]

function createDataSource(
    {
        name,
        fetch,
    }: {
        name: string
        fetch: (pressRoomId: string) => Promise<PrCoItem[]>
    },
    [...fields]: PrCoField[]
): PrcoDataSource {
    return {
        id: name,
        name,
        fields,
        fetch,
    }
}

/**
 * Remove PrCo-specific keys from the fields. This is used to ensure that the fields are compatible with Framer API.
 *
 * @param fields - The fields to remove the keys from.
 * @returns The fields with the keys removed.
 */
export function removePrCoKeys(fields: PrCoField[]): ManagedCollectionFieldInput[] {
    return fields.map(originalField => {
        if (originalField.type === "multiCollectionReference" || originalField.type === "collectionReference") {
            const { getValue, key, dataSourceId, supportedCollections, ...field } = originalField
            return field
        }

        const { getValue, key, canBeUsedAsSlug, ...field } = originalField
        return field
    })
}
