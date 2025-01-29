import { ManagedCollectionField } from "framer-plugin"
import { framer } from "framer-plugin"
import { ContentTypeField } from "contentful"
import { documentToHtmlString } from "@contentful/rich-text-html-renderer"
import { BLOCKS } from "@contentful/rich-text-types"

export type ExtendedManagedCollectionField = ManagedCollectionField & {
    isDisabled?: boolean
    field?: ContentTypeField
    isMissingReference?: boolean
    collectionId?: string
}

export async function getFramerFieldFromContentfulField(
    field: ContentTypeField
): Promise<ExtendedManagedCollectionField> {
    const baseField = {
        id: field.id ?? "",
        name: field.name ?? "",
        userEditable: false,
    }

    let collections = await framer.getPluginData("contentful:collections")
    collections = collections ? JSON.parse(collections) : {}

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
                const validationContentType = field?.validations?.[0]?.linkContentType?.[0]
                const collectionId = collections?.[validationContentType]?.id

                if (!validationContentType || !collectionId) {
                    return { ...baseField, type: "string", isMissingReference: true }
                }

                return { ...baseField, type: "collectionReference", collectionId }
            }

            return { ...baseField, type: "string" }
        case "Array":
            if (field.items?.type === "Link") {
                if (field.items.linkType === "Asset") {
                    // For arrays of assets (e.g., multiple images)
                    if (field.items?.validations[0]?.linkMimetypeGroup?.[0] === "image") {
                        return { ...baseField, type: "image" }
                    }

                    // TODO: Add support for other mimetypes
                }

                if (field.items.linkType === "Entry") {
                    const validationContentType = field?.items?.validations?.[0]?.linkContentType?.[0]
                    const collectionId = collections?.[validationContentType]?.id

                    if (!validationContentType || !collectionId) {
                        return { ...baseField, type: "string", isMissingReference: true }
                    }

                    return { ...baseField, type: "multiCollectionReference", collectionId }
                }
            }
            return { ...baseField, type: "string" }
        default:
            return { ...baseField, type: "string" }
    }
}

export function mapContentfulValueToFramerValue(value: ContentTypeField, framerField: ExtendedManagedCollectionField) {
    if (value === null || value === undefined) {
        if (framerField?.type === "boolean") {
            return false
        }

        if (framerField?.type === "number") {
            return 0
        }

        if (framerField?.type === "multiCollectionReference") {
            return []
        }

        if (framerField?.type === "collectionReference") {
            return ""
        }

        return ""
    }

    if (framerField?.type === "boolean") {
        return Boolean(value)
    }

    if (framerField?.type === "number") {
        return Number(value)
    }

    if (framerField?.type === "date" || framerField?.type === "color") {
        return String(value)
    }

    const fieldType = framerField?.field?.type
    const linkType = framerField?.field?.linkType

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

        if (framerField?.type === "image") {
            // Framer doesn't support multiple images in a collection field, so we need to return the first image
            return returnValue[0]
        }

        if (framerField?.type === "string") {
            return returnValue.join(",")
        }

        return returnValue
    }

    if (fieldType === "Link" && typeof value === "object" && value !== null) {
        const item = value as {
            sys?: { type?: string; id?: string }
            fields?: { file?: { url?: string } }
        }

        if (item.sys?.type === "Asset" && linkType === "Asset") {
            // return item.fields?.file?.url || ""

            let url = item.fields?.file?.url || ""

            if (url.startsWith("//")) {
                url = "https:" + url
            }

            return url
        }

        if (item.sys?.type === "Entry" && linkType === "Entry" && item.sys.id) {
            return item.sys.id
        }

        return ""
    }

    if (fieldType === "RichText") {
        return documentToHtmlString(value, {
            renderNode: {
                [BLOCKS.EMBEDDED_ASSET]: node => {
                    if (node?.nodeType === "embedded-asset-block") {
                        let url = node.data.target.fields.file.url

                        if (url.startsWith("//")) {
                            url = "https:" + url
                        }

                        return `<img src="${url}" />`
                    }
                },
            },
        })
    }

    return String(value)
}
