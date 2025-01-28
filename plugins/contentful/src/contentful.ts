import { documentToHtmlString } from "@contentful/rich-text-html-renderer"
import { createClient, ContentfulClientApi } from "contentful"
import { CollectionItem, framer, type ManagedCollectionField } from "framer-plugin"
import { BLOCKS, MARKS } from '@contentful/rich-text-types';

interface ContentfulConfig {
    space: string
    accessToken: string
}

type ContentfulEntry = {
    sys: {
        id: string
        type: string
        contentType: {
            sys: {
                id: string
            }
        }
    }
    fields: Record<string, unknown>
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

export const getEntriesForContentType = async (contentTypeId: string) => {
    if (!contentfulClient) throw new Error("Contentful client not initialized")
    const entries = await contentfulClient.getEntries({
        content_type: contentTypeId,
        // include: 10, // Include linked entries
        // include: 0, // Include linked entries
        // include: 10, // Include linked entries
    })
    // console.log('Raw Contentful entries:', JSON.stringify(entries, null, 2))
    return entries.items
}

export const mapContentfulToFramerCollection = async (contentTypeId: string, entries: ContentfulEntry[]) => {
    if (entries.length === 0) {
        throw new Error("No entries found for this content type")
    }

    // Get the content type to access field definitions
    if (!contentfulClient) throw new Error("Contentful client not initialized")
    const contentType = await contentfulClient.getContentType(contentTypeId)

    let collections = await framer.getPluginData("contentful:collections")
    collections = collections ? JSON.parse(collections) : {}
    console.log("collections", collections)

    // console.log('Raw Contentful content type:', JSON.stringify(contentType, null, 2))
    // console.log('Content type:', {
    //     id: contentType.sys.id,
    //     name: contentType.name,
    //     displayField: contentType.displayField,
    //     fields: contentType.fields.map(f => ({
    //         id: f.id,
    //         name: f.name,
    //         type: f.type,
    //         linkType: f.linkType,
    //         items: f.items,
    //         required: f.required,
    //         validations: f.validations
    //     }))
    // })

    // console.log('entries', JSON.stringify(entries, null, 2))

    // Map Contentful fields to Framer schema using content type definition
    const framerFields: ManagedCollectionField[] = contentType.fields.map((field): ManagedCollectionField => {
        console.log("Mapping field:", {
            id: field.id,
            name: field.name,
            type: field.type,
            linkType: field.linkType,
            items: field.items,
        }, JSON.stringify(field, null, 2))

        const baseField = {
            id: field.id,
            name: field.name,
            userEditable: false,
            // userEditable: true, // will prevent the field from being filled in the CMS programatically
        }

        // Map Contentful field types to Framer field types
        switch (field.type) {
            case "Integer":
            case "Number":
                return { ...baseField, type: "number" }
            case "Boolean":
                return { ...baseField, type: "boolean" }
            case "Date":
                return { ...baseField, type: "date" }
            case "Text":
            case "Symbol":
                return { ...baseField, type: "string" }
            case "RichText":
                return { ...baseField, type: "formattedText" }
            case "Link":
                if (field.linkType === "Asset") {
                    return { ...baseField, type: "image" }
                }
                if (field.linkType === "Entry") {
                    // For Entry references, we need to store the ID
                    // console.log("field.items.validations[0].linkContentType[0]", field.validations[0].linkContentType)
                    const validationContentType = field?.validations?.[0]?.linkContentType?.[0]

                    if (!validationContentType) { // TODO: This is a workaround for when the content type is not set so we can't find the collection
                        console.warn(`Field ${field.id} has no validation content type`)
                        framer.notify(`Field ${field.id} has no validation content type`, { variant: "warning" })
                        return { ...baseField, type: "string" }
                    }


                    const collectionId = collections?.[validationContentType]

                    if (!collectionId) {
                        console.warn(`Field ${field.id} has no collectionId for validation content type ${validationContentType}`)
                        framer.notify(`Field ${field.id} has no collectionId for validation content type ${validationContentType}`, { variant: "warning" })
                        return { ...baseField, type: "string" }
                    }


                    // const contentTypes = field.items?.validations[0]?.linkContentType || []
                    // const collectionIds = contentTypes.map(contentType => collections[contentType])
                    // console.log("collectionIds", collectionIds)
                    // console.log("collectionId", collections, field.validations[0].linkContentType[0], collectionId)
                    return { ...baseField, type: "collectionReference", collectionId }
                    // console.log(field.validations[0].linkContentType[0])
                    // return { ...baseField, type: "string" }
                }
                return { ...baseField, type: "string" }
            case "Array":
                if (field.items?.type === "Link") {
                    if (field.items.linkType === "Asset") {
                        // For arrays of assets (e.g., multiple images)
                        // console.log("field.items.linkType", field)
                        if (field.items?.validations[0]?.linkMimetypeGroup?.[0] === "image") {
                            return { ...baseField, type: "image" }
                        }

                        // TODO: Add support for other mimetypes
                    }
                    if (field.items.linkType === "Entry") {
                        // console.log("field.validations[0].linkContentType[0]", field.validations[0].linkContentType[0])

                        const validationContentType = field?.items?.validations?.[0]?.linkContentType?.[0]

                        if (!validationContentType) { // TODO: This is a workaround for when the content type is not set so we can't find the collection
                            console.warn(`Field ${field.id} has no validation content type`)
                            framer.notify(`Field ${field.id} has no validation content type`, { variant: "warning" })
                            return { ...baseField, type: "string" }
                        }

                        const collectionId = collections?.[validationContentType]

                        if (!collectionId) {
                            console.warn(`Field ${field.id} has no collectionId for validation content type ${validationContentType}`)
                            framer.notify(`Field ${field.id} has no collectionId for validation content type ${validationContentType}`, { variant: "warning" })
                            return { ...baseField, type: "string" }
                        }



                        // For arrays of references, store as comma-separated IDs
                        // return { ...baseField, type: "string" }
                        return { ...baseField, type: "multiCollectionReference", collectionId }
                    }
                }
                // For arrays of primitives
                return { ...baseField, type: "string" }
            default:
                return { ...baseField, type: "string" }
        }
    })

    console.log("Mapped Framer fields:", JSON.stringify(framerFields, null, 2))

    // Helper function to safely extract field values
    const extractFieldValue = (value: unknown, fieldType: string, linkType?: string, framerField?: ManagedCollectionField): string | string[] | boolean | number => {
        if (value === null || value === undefined) {
            if (framerField?.type === "number") {
                return 0
            }

            if (framerField?.type === "multiCollectionReference") {
                return []
            }
            return ''
        }



        if (fieldType === "Integer" || fieldType === "Number") {
            return Number(value)
        }

        if (fieldType === "Array" && Array.isArray(value)) {
            const returnValue = value
                .map(item => {
                    if (item && typeof item === "object" && "sys" in item && "fields" in item) {
                        if (item.sys.type === "Asset" && "file" in item.fields) {
                            let url = item.fields?.file?.url || ""

                            if (url.startsWith("//")) {
                                url = "https:" + url
                            }

                            return url
                        }
                        if (item.sys.type === "Entry") {
                            return item.sys.id
                        }
                    }
                    return typeof item === "string" ? item : ""
                })
                .filter(Boolean)


            // console.log("returnValue", returnValue, framerField)

            if (framerField?.type === "image") {
                // Framer doesn't support multiple images in a collection field, so we need to return the first image
                return returnValue[0]
            }

            if (framerField?.type === "string") {
                return returnValue.join(",")
            }

            return returnValue

            // if (returnValue.length > 0) {
            // return 'Entries: ' + returnValue.join(",") // TODO: https://www.framer.com/developers/plugins/cms#reference-fields
            // }

            // return ""
        }

        if (fieldType === "Link" && typeof value === "object" && value !== null) {
            const item = value as { sys?: { type?: string; id?: string }; fields?: { file?: { url?: string } } }
            // console.log(value,item.sys.id)

            if (item.sys?.type === "Asset" && linkType === "Asset") {
                // return item.fields?.file?.url || ""

                let url = item.fields?.file?.url || ""

                if (url.startsWith("//")) {
                    url = "https:" + url
                }

                return url

            }


            if (item.sys?.type === "Entry" && linkType === "Entry" && item.sys.id) {
                // console.log(value, item.sys.id)
                // return "Entry: " + item.sys.id // TODO: https://www.framer.com/developers/plugins/cms#reference-fields
                return item.sys.id
                // return '5pJhJPUcTzpAL9ZPeXL7hr'
            }

            // console.log(field,item.sys.id, linkType)

            return ""
        }

        if (fieldType === "RichText") {
            // if (typeof value === "object" && value !== null) {
            //     const richText = value as { content?: Array<{ value?: string }> }
            //     console.log("richText", JSON.stringify(richText.content, null, 2))
            //     if (Array.isArray(richText.content)) {
            //         return richText.content.map(node => node.value || "").join("\n")
            //     }
            // }
            // return ""

            return documentToHtmlString(value, {
                renderNode: {
                    [BLOCKS.EMBEDDED_ASSET]: (node, next) => {
                        if (node?.nodeType === "embedded-asset-block") {
                            let url = node.data.target.fields.file.url

                            if (url.startsWith("//")) {
                                url = "https:" + url
                            }

                            return `<img src="${url}" />`
                        }
                    }
                }
            })
        }

        if (fieldType === "Boolean") {
            return Boolean(value)
        }

        return String(value)
    }

    // Map entries to Framer collection items
    const items = entries.map(entry => {
        const fields = entry.fields as Record<string, unknown>

        // Get the slug from the display field if available, or fall back to ID
        const displayField = contentType.displayField
        const slug = displayField ? String(fields[displayField] || entry.sys.id) : entry.sys.id

        const fieldData = contentType.fields.reduce(
            (acc, field) => {
                const value = fields[field.id]
                acc[field.id] = extractFieldValue(value, field.type, field.linkType, framerFields.find(f => f.id === field.id))
                return acc
            },
            {} as Record<string, string | string[]>
        )

        const item = {
            id: String(entry.sys.id),
            slug,
            fieldData,
        }

        console.log("Mapped item:", String(entry.sys.id), JSON.stringify(fieldData, null, 2))
        return item
    })

    return {
        fields: framerFields,
        items,
    }
}
