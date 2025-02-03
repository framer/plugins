import { createClient, ContentfulClientApi } from "contentful"

interface ContentfulConfig {
    space: string
    accessToken: string
}

let contentfulClient: ContentfulClientApi<undefined> | null = null

export const initContentful = (config: ContentfulConfig) => {
    contentfulClient = createClient({
        space: config.space,
        accessToken: config.accessToken,
    })
}

export const getContentTypes = async () => {
    if (!contentfulClient) throw new Error("Contentful client not initialized")
    const response = await contentfulClient.getContentTypes()
    return response.items
}

export const getContentType = async (contentTypeId: string) => {
    if (!contentfulClient) throw new Error("Contentful client not initialized")
    const response = await contentfulClient.getContentType(contentTypeId)
    return response
}

export const getEntriesForContentType = async (contentTypeId: string) => {
    if (!contentfulClient) throw new Error("Contentful client not initialized")
    const entries = await contentfulClient.getEntries({
        content_type: contentTypeId,
    })

    return entries.items
}
