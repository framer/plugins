import { useInfiniteQuery } from "@tanstack/react-query";
import * as v from "valibot";

const urlsSchema = v.object({
  full: v.string(),
  raw: v.string(),
  regular: v.string(),
  small: v.string(),
  thumb: v.string()
});

const unsplashUserSchema = v.object({
  name: v.string(),
  links: v.object({
    html: v.string()
  })
});

const unsplashPhotoSchema = v.object({
  id: v.string(),
  width: v.number(),
  height: v.number(),
  color: v.string(),
  alt_description: v.nullable(v.string()),
  description: v.nullable(v.string()),
  blur_hash: v.string(),
  urls: urlsSchema,
  user: unsplashUserSchema
});

const listPhotosSchema = v.object({
  results: v.array(unsplashPhotoSchema),
  total: v.number(),
  total_pages: v.number()
});

export type UnsplashPhoto = v.Input<typeof unsplashPhotoSchema>;

export type UnsplashUrls = v.Input<typeof urlsSchema>;
export type UnsplashLinks = v.Input<typeof unsplashUserSchema>;
export type UnsplashUser = v.Input<typeof unsplashUserSchema>;

const UNSPLASH_BASE_URL = "https://api.unsplash.com";

const pageItemCount = 20;

interface FetchOptions extends Omit<RequestInit, "headers"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
}

export async function fetchUnsplash<TSchema extends v.BaseSchema>(
  path: string,
  schema: TSchema,
  { body, ...options }: FetchOptions = {}
): Promise<v.Input<TSchema>> {
  const response = await fetch(`${UNSPLASH_BASE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Accept-Version": "v1",
      Authorization: `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY}`,
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Unsplash API:" + response.status);
  }

  const json = (await response.json()) as unknown;

  const result = v.safeParse(schema, json);

  if (result.issues) {
    throw new Error("Failed to parse Unsplash API response: " + result.issues);
  }

  return result.output;
}

export function useListPhotosInfinite(query: string) {
  return useInfiniteQuery({
    queryKey: ["photos", query],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const page = pageParam ?? 1;

      if (query.length === 0) {
        const photos = await fetchUnsplash(
          `/photos?page=${page}&per_page=${pageItemCount}`,
          v.array(unsplashPhotoSchema),
          {
            signal,
            method: "GET"
          }
        );

        return {
          results: photos,
          total: photos.length,
          total_pages: undefined
        };
      }

      return fetchUnsplash(
        `/search/photos?query=${query}&page=${pageParam ?? 1}&per_page=${pageItemCount}`,
        listPhotosSchema,
        { signal, method: "GET" }
      );
    },
    getNextPageParam: (data, allPages) => {
      if (!data.total_pages || data.total_pages >= allPages.length - 1) {
        return allPages.length + 1;
      }

      return undefined;
    }
  });
}

export async function getRandomPhoto(searchTerm: string) {
  const params = new URLSearchParams();

  if (searchTerm.length > 0) {
    params.set("query", searchTerm);
  }

  return fetchUnsplash(
    `/photos/random?${params.toString()}`,
    unsplashPhotoSchema,
    { method: "GET" }
  );
}
