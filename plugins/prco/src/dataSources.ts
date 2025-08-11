import type { ManagedCollectionFieldInput } from "framer-plugin"
import * as v from "valibot"
import {
    ClippingImageAsImageSchema,
    ClippingsSchema,
    ImageUrlFromSizes,
    MediaInfoSchema,
    MediaKitsSchema,
    type PrCoItem,
    PressReleasesSchema,
    SocialKeysAsStringSchema,
    TagsSchema,
} from "./api-types"

export interface PrCoDataSource {
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

export type PrCoField = ManagedCollectionFieldInput &
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

const TagSchema = v.object({ data: v.array(TagsSchema) })
interface TagResponse {
    data: ({ slug?: string } & Record<string, any>)[]
}
const TagDataSource = createDataSource(
    {
        name: "Tags",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/tags.json`
            const rawData = (await fetchPrCoData(url)) as TagResponse
            if (rawData.data && Array.isArray(rawData.data)) {
                rawData.data = rawData.data.map((tag: any, index: number) => ({
                    ...tag,
                    id: tag.slug || `tag-${index}-${Date.now()}`,
                }))
            }
            const data = v.safeParse(TagSchema, rawData)

            if (!data.success) {
                console.log("Error parsing PrCo data:", data.issues)
                throw new Error("Error parsing PrCo data")
            }

            return data.output.data
        },
    },
    [
        { id: "name", name: "Name", type: "string", canBeUsedAsSlug: true },
        { id: "id", name: "Id", type: "string", canBeUsedAsSlug: true },
        { id: "pressroom_id", name: "Press Room ID", type: "number" },
        { id: "description", name: "Body Html", type: "formattedText" },
        { id: "layout", name: "Layout", type: "date" },
        {
            id: "image",
            name: "Image",
            type: "image",
            getValue: value => {
                if (value && Object.keys(value).length === 0) {
                    return v.parse(ImageUrlFromSizes, value)
                }
            },
        },
    ]
)

const ClippingSchema = v.object({ data: v.array(ClippingsSchema) })
const ClippingDataSource = createDataSource(
    {
        name: "Clippings",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/clippings.json`
            const data = v.safeParse(ClippingSchema, await fetchPrCoData(url))

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
        { id: "pressroom_id", name: "Press Room ID", type: "number" },
        { id: "press_release_id", name: "Press Release Date", type: "date" },
        { id: "state", name: "State", type: "string" },
        { id: "description", name: "Description", type: "string" },
        { id: "release_date", name: "Release Date", type: "date" },
        { id: "source", name: "Source", type: "string" },
        { id: "url", name: "URL", type: "link" },
        /* {
            id: "featured_images",
            name: "Featured Images",
            type: "string",
            getValue: value => {
                const list = v.parse(v.array(v.object({ url: v.string() })), value)
                return list.map(item => { item.url})
            },
        },*/
        { id: "language", name: "Language", type: "string" },
        {
            id: "shares",
            name: "Shares",
            type: "string",
            getValue: value => {
                if (value && Object.keys(value).length === 0) {
                    return v.parse(SocialKeysAsStringSchema, value)
                }
            },
        },
        {
            id: "clipping_image",
            name: "Clipping Image",
            type: "image",
            getValue: value => {
                if (value && Object.keys(value).length === 0) {
                    return v.parse(ClippingImageAsImageSchema, value)
                }
            },
        },
        {
            id: "sizes",
            name: "Sizes",
            type: "image",
            getValue: value => {
                if (value && Object.keys(value).length === 0) {
                    return v.parse(ImageUrlFromSizes, value)
                }
            },
        },
        { id: "alexa", name: "Alexa", type: "string" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "type", name: "Type", type: "string" },
        { id: "pdf", name: "PDF", type: "link" },
        { id: "private", name: "Private", type: "boolean" },
        { id: "show_iframe", name: "Show Iframe", type: "boolean" },
        { id: "published_at", name: "Published At", type: "date" },
    ]
)

const MediaSchema = v.object({ data: v.array(MediaInfoSchema) })

const MediaDataSource = createDataSource(
    {
        name: "Media",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/media_kits.json`
            const ApiResponseSchema = v.object({
                data: v.array(
                    v.object({
                        media: v.array(MediaInfoSchema),
                    })
                ),
            })
            const validated = v.parse(ApiResponseSchema, await fetchPrCoData(url))
            const data = v.safeParse(MediaSchema, { data: validated.data.flatMap(item => item.media) })
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
        { id: "pressroom_id", name: "Press Room ID", type: "number" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "type", name: "Type", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "transparent", name: "Transparent", type: "boolean" },
        { id: "file_size", name: "File Size", type: "number" },
        { id: "url", name: "URL", type: "link" },
        { id: "webm_url", name: "Webm URL", type: "link" },
        { id: "mp4_url", name: "MP4 URL", type: "link" },
        { id: "thumbnail_url", name: "Thumbnail", type: "image" },
        {
            id: "sizes",
            name: "Sizes",
            type: "image",
            getValue: value => {
                if (value && Object.keys(value).length === 0) {
                    return v.parse(ImageUrlFromSizes, value)
                }
            },
        },
    ]
)

const ImageDataSource = createDataSource(
    {
        name: "Images",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/images.json`
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
        { id: "pressroom_id", name: "Press Room ID", type: "number" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "type", name: "Type", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "transparent", name: "Transparent", type: "boolean" },
        { id: "file_size", name: "File Size", type: "number" },
        {
            id: "sizes",
            name: "Sizes",
            type: "image",
            getValue: value => {
                if (value && Object.keys(value).length === 0) {
                    return v.parse(ImageUrlFromSizes, value)
                }
            },
        },
    ]
)

const MovieDataSource = createDataSource(
    {
        name: "Movies",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/movies.json`
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
        { id: "pressroom_id", name: "Press Room ID", type: "number" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "type", name: "Type", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "file_size", name: "File Size", type: "number" },
        { id: "url", name: "URL", type: "link" },
        { id: "webm_url", name: "Webm URL", type: "link" },
        { id: "mp4_url", name: "MP4 URL", type: "link" },
        { id: "mp4_1080p_url", name: "MP4 1080P URL", type: "link" },
        { id: "thumbnail_url", name: "Thumbnail", type: "image" },
        { id: "thumbnail_1080p_url", name: "Thumbnail 1080P URL", type: "image" },
    ]
)

const DocumentsDataSource = createDataSource(
    {
        name: "Documents",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/documents.json`
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
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "type", name: "Type", type: "string" },
        { id: "content_type", name: "Content Type", type: "string" },
        { id: "has_thumb", name: "Has Thumb", type: "boolean" },
        { id: "file_size", name: "File Size", type: "number" },
        { id: "url", name: "URL", type: "link" },
    ]
)
const MediaKitSchema = v.object({ data: v.array(MediaKitsSchema) })
const MediaKitDataSource = createDataSource(
    {
        name: "Media Kits",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/media_kits.json`
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
        { id: "category_id", name: "Category Id", type: "number" },
        { id: "media_count", name: "Media Count", type: "number" },
        { id: "total_size", name: "Total Size", type: "number" },
        { id: "is_locked", name: "Is Locked", type: "boolean" },
        { id: "is_password_protected", name: "Is Password Protected", type: "boolean" },
        {
            id: "medias",
            name: MediaDataSource.name,
            type: "multiCollectionReference",
            dataSourceId: MediaDataSource.name,
            collectionId: "",
        },
    ]
)

const PressReleaseSchema = v.object({ data: v.array(PressReleasesSchema) })
const PressReleaseDataSource = createDataSource(
    {
        name: "Press Releases",
        fetch: async (pressRoomId: string) => {
            const url = `https://api.pr.co/v1/pressrooms/${pressRoomId}/press_releases.json?includes=featured_images,tags`
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
        { id: "pressroom_id", name: "Press Room ID", type: "number" },
        { id: "subtitle", name: "Sub Title", type: "string" },
        { id: "release_date", name: "Release Date", type: "date" },
        { id: "release_location", name: "Release Location", type: "string" },
        { id: "language", name: "Language", type: "string" },
        { id: "social_media_pitch", name: "Social Media Pitch", type: "string" },
        {
            id: "tags",
            name: TagDataSource.name,
            type: "multiCollectionReference",
            dataSourceId: TagDataSource.name,
            collectionId: "",
        },
        {
            id: "featured_images",
            name: "Featured Images",
            type: "multiCollectionReference",
            dataSourceId: ImageDataSource.name,
            collectionId: "",
        },
        { id: "summary", name: "Summary", type: "formattedText" },
        { id: "body_html", name: "Body Html", type: "formattedText" },
        { id: "permalink", name: "Permalink", type: "string" },
        { id: "full_url", name: "Full URL", type: "link" },
        { id: "type", name: "Type", type: "string" },
        { id: "state", name: "State", type: "string" },
        { id: "pdf", name: "PDF", type: "link" },
        { id: "show_in_timeline", name: "Show In Timeline", type: "boolean" },
        { id: "show_boilerplate_text", name: "Show Boilerplate Text", type: "boolean" },
        { id: "freeform_two", name: "Freeform Two", type: "boolean" },
        { id: "reading_time", name: "Reading Time", type: "number" },
        { id: "updated_at", name: "Updated At", type: "string" },
    ]
)

export const dataSources = [
    PressReleaseDataSource,
    ClippingDataSource,
    MediaKitDataSource,
    ImageDataSource,
    MovieDataSource,
    DocumentsDataSource,
] satisfies PrCoDataSource[]

function createDataSource(
    {
        name,
        fetch,
    }: {
        name: string
        fetch: (pressRoomId: string) => Promise<PrCoItem[]>
    },
    [idField, slugField, ...fields]: [PrCoField, PrCoField, ...PrCoField[]]
): PrCoDataSource {
    return {
        id: name,
        name,
        fields: [idField, slugField, ...fields],
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
        const { getValue, ...field } = originalField
        return field
    })
}
