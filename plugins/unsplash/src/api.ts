import { useInfiniteQuery } from "@tanstack/react-query"
import * as v from "valibot"

const urlsSchema = v.object({
    full: v.string(),
    raw: v.string(),
    regular: v.string(),
    small: v.string(),
    thumb: v.string(),
})

const unsplashUserSchema = v.object({
    name: v.string(),
    links: v.object({
        html: v.string(),
    }),
})

const unsplashPhotoSchema = v.object({
    id: v.string(),
    width: v.number(),
    height: v.number(),
    color: v.string(),
    alt_description: v.nullable(v.string()),
    description: v.nullable(v.string()),
    blur_hash: v.nullable(v.string()),
    plus: v.optional(v.boolean()),
    urls: urlsSchema,
    user: unsplashUserSchema,
})

const listPhotosSchema = v.object({
    results: v.array(unsplashPhotoSchema),
    total: v.number(),
    total_pages: v.number(),
})

export type UnsplashPhoto = v.InferInput<typeof unsplashPhotoSchema>

export type UnsplashUrls = v.InferInput<typeof urlsSchema>
export type UnsplashLinks = v.InferInput<typeof unsplashUserSchema>
export type UnsplashUser = v.InferInput<typeof unsplashUserSchema>

const UNSPLASH_BASE_URL = "https://unsplash-plugin.framer-team.workers.dev"

const pageItemCount = 20

interface FetchOptions extends Omit<RequestInit, "headers" | "body"> {
    body?: unknown
}

export async function fetchUnsplash<TSchema extends v.GenericSchema>(
    path: string,
    schema: TSchema,
    { body, ...options }: FetchOptions = {}
): Promise<v.InferInput<TSchema>> {
    const response = await fetch(`${UNSPLASH_BASE_URL}${path}`, {
        body: body ? JSON.stringify(body) : undefined,
        ...options,
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch Unsplash API: ${response.status}`)
    }

    const json = (await response.json()) as unknown

    const result = v.safeParse(schema, json)

    if (result.issues) {
        throw new Error(`Failed to parse Unsplash API response: ${JSON.stringify(result.issues)}`)
    }

    return result.output
}

export function useListPhotosInfinite(query: string) {
    return useInfiniteQuery({
        queryKey: ["photos", query],
        initialPageParam: 1,
        queryFn: async ({ pageParam, signal }) => {
            if (query.length === 0) {
                const photos = await fetchUnsplash(
                    `/photos?page=${pageParam}&per_page=${pageItemCount}`,
                    v.array(unsplashPhotoSchema),
                    {
                        signal,
                        method: "GET",
                    }
                )

                return {
                    results: photos,
                    total: photos.length,
                    total_pages: undefined,
                }
            }

            const result = await fetchUnsplash(
                `/search/photos?query=${query}&page=${pageParam}&per_page=${pageItemCount}`,
                listPhotosSchema,
                { signal, method: "GET" }
            )

            return {
                results: result.results,
                total: result.total,
                total_pages: result.total_pages,
            }
        },
        getNextPageParam: (data, allPages) => {
            if (!data.total_pages || data.total_pages >= allPages.length - 1) {
                return allPages.length + 1
            }

            return undefined
        },
    })
}

export async function getRandomPhoto(searchTerm: string) {
    const params = new URLSearchParams()

    if (searchTerm.length > 0) {
        params.set("query", searchTerm)
    }

    return fetchUnsplash(`/photos/random?${params.toString()}`, unsplashPhotoSchema, { method: "GET" })
}
