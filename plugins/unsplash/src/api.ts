import { useInfiniteQuery } from "@tanstack/react-query";
import * as v from "valibot";
import { framer } from "@framerjs/plugin-api";

const urlsSchema = v.object({
  full: v.string(),
  raw: v.string(),
  regular: v.string(),
  small: v.string(),
  thumb: v.string(),
});

const unsplashUserSchema = v.object({
  name: v.string(),
  links: v.object({
    html: v.string(),
  }),
});

const unsplashPhotoSchema = v.object({
  id: v.string(),
  width: v.number(),
  height: v.number(),
  color: v.string(),
  alt_description: v.nullable(v.string()),
  description: v.nullable(v.string()),
  urls: urlsSchema,
  user: unsplashUserSchema,
});

const listPhotosSchema = v.object({
  photos: v.array(unsplashPhotoSchema),
  total: v.number(),
});

const searchPhotosSchema = v.object({
  results: v.array(unsplashPhotoSchema),
  total: v.number(),
});

export type UnsplashPhoto = v.Input<typeof unsplashPhotoSchema>;

export type UnsplashUrls = v.Input<typeof urlsSchema>;
export type UnsplashLinks = v.Input<typeof unsplashUserSchema>;
export type UnsplashUser = v.Input<typeof unsplashUserSchema>;

function validateResponse<TSchema extends v.BaseSchema>(
  schema: TSchema,
  response: unknown
) {
  const result = v.safeParse(schema, response);

  if (result.issues) {
    throw new Error("Failed to parse Unsplash API response: " + result.issues);
  }

  return result.output;
}

export function useListPhotosInfinite(query: string) {
  return useInfiniteQuery({
    queryKey: ["photos", query],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = pageParam ?? 1;

      if (query.length === 0) {
        const response = await framer.internalApiGet(`/web/unsplash/photos`, {
          page,
          order_by: "latest",
          per_page: 12,
        });

        const result = validateResponse(listPhotosSchema, response);

        return {
          results: result.photos,
          total: result.photos.length,
        };
      }

      const result = await framer.internalApiGet(
        `/web/unsplash/search/photos`,
        {
          query,
          page,
          per_page: 12,
        }
      );

      return validateResponse(searchPhotosSchema, result);
    },
    getNextPageParam: (_, allPages) => {
      return allPages.length + 1;
    },
  });
}

export async function getRandomPhoto(searchTerm: string) {
  const params = new URLSearchParams();

  if (searchTerm.length > 0) {
    params.set("query", searchTerm);
  }

  const response = await framer.internalApiGet(
    `/web/unsplash/photos/random`,
    {}
  );

  return validateResponse(unsplashPhotoSchema, response);
}
