import { framer, type ToolSchemaV1 } from "framer-plugin"
import { searchPhotos } from "../api"

interface SearchImagesToolInput {
    prompt: string
    max?: number
}

interface SearchImagesToolOutput {
    images: string[]
}

const searchImagesInputSchema: ToolSchemaV1 = {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: {
        prompt: {
            type: "string",
            description: "Search prompt for Unsplash images.",
        },
        max: {
            type: "number",
            description: "Optional maximum number of images to return.",
        },
    },
}

const searchImagesOutputSchema: ToolSchemaV1 = {
    type: "object",
    additionalProperties: false,
    required: ["images"],
    properties: {
        images: {
            type: "array",
            description: "List of Unsplash image URLs.",
            items: {
                type: "string",
            },
        },
    },
}

const defaultImageCount = 1
const maxImageCount = 10

function normalizeRequestedImageCount(max?: number): number {
    if (max === undefined) return defaultImageCount
    if (!Number.isFinite(max)) return defaultImageCount
    return Math.min(maxImageCount, Math.max(1, Math.floor(max)))
}

async function searchImages(input: SearchImagesToolInput): Promise<SearchImagesToolOutput> {
    const count = normalizeRequestedImageCount(input.max)
    const photos = await searchPhotos(input.prompt, count)

    return {
        images: photos.map(photo => photo.urls.full),
    }
}

export function registerAgentTools() {
    framer.registerAgentTools({
        search_images: {
            inputSchema: searchImagesInputSchema,
            outputSchema: searchImagesOutputSchema,
            handler: async input => searchImages(input as SearchImagesToolInput),
        },
    })
}
