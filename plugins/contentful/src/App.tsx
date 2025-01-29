import { ContentType, ContentTypeField } from "contentful"

// import "./App.css"
import { CollectionItemData, framer, ManagedCollectionField } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { initContentful, getContentTypes, getEntriesForContentType } from "./contentful"
import { Auth } from "./components/auth"
import { ContentTypePicker } from "./components/content-type-picker"
// import { CheckboxTextfield } from "./components/checkbox-text-field"
// import cx from "classnames"
// import { useInView } from "react-intersection-observer"
import { Fields } from "./components/fields"
import { documentToHtmlString } from "@contentful/rich-text-html-renderer"
import { BLOCKS } from "@contentful/rich-text-types"

function mapContentfulValueToFramerValue(value: ContentTypeField, framerField: ExtendedManagedCollectionField) {
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

    const fieldType = framerField?.field?.type
    const linkType = framerField?.field?.linkType

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
            // return "Entry: " + item.sys.id // TODO: https://www.framer.com/developers/plugins/cms#reference-fields
            return item.sys.id
            // return '5pJhJPUcTzpAL9ZPeXL7hr'
        }

        // console.log(field,item.sys.id, linkType)

        return ""
    }

    if (fieldType === "RichText") {
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
                },
            },
        })
    }

    if (fieldType === "Boolean") {
        return Boolean(value)
    }

    return String(value)
}

export type ExtendedManagedCollectionField = ManagedCollectionField & {
    isDisabled?: boolean
    field?: ContentTypeField
    isMissingReference?: boolean
    collectionId?: string
}

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [contentfulConfig, setContentfulConfig] = useState({
        space: "", // "v1sdaxrypttu",
        accessToken: "", // "LNiCWA-oM2X5XeQXXTKa2uCQbHWy7tnUPMtoSioykEg",
    })
    const [contentTypes, setContentTypes] = useState<ContentType[]>([])
    const [isAuthenticated, setIsAuthenticated] = useState(false) // contentful space and access token are set and valid
    const [contentType, setContentType] = useState<ContentType | null>(null)

    useEffect(() => {
        async function cache() {
            const contentTypeId = contentType?.sys?.id

            if (!contentTypeId) return

            const collection = await framer.getManagedCollection()

            const collectionsList = await framer.getPluginData("contentful:collections")
            const collections = collectionsList ? JSON.parse(collectionsList) : {}
            collections[contentTypeId] = collection
            await framer.setPluginData("contentful:collections", JSON.stringify(collections))
        }

        if (contentType) {
            cache()
        }
    }, [contentType])

    const fieldsRef = useRef<{ reset: () => void } | null>(null)

    const hasTriggeredSyncRef = useRef(false)

    useEffect(() => {
        async function configure() {
            setIsLoading(true)

            const collection = await framer.getManagedCollection()

            const credentials = await collection.getPluginData("contentful")

            if (credentials) {
                initContentful(JSON.parse(credentials))

                const contentTypes = await fetchContentTypes()
                setContentTypes(contentTypes)
                setIsAuthenticated(true)

                const contentTypeId = await collection.getPluginData("contentTypeId")
                const contentType = contentTypes.find(ct => ct.sys.id === contentTypeId)
                if (contentType) {
                    setContentType(contentType)
                }
            }

            framer.showUI({
                width: 340,
                height: 370,
                resizable: false,
            })
            setIsLoading(false)
        }

        // console.log("useEffect", framer.mode)
        if (framer.mode === "syncManagedCollection") {
            // When in sync mode, don't show UI
            if (!hasTriggeredSyncRef.current) {
                sync()
                hasTriggeredSyncRef.current = true
            }
        } else {
            // if (framer.mode === "configureManagedCollection") {
            //     console.log("configureManagedCollection")
            // }

            try {
                configure()
            } catch (error) {
                console.error("Failed to configure Contentful plugin:", error)
                framer.notify("Failed to configure Contentful plugin", { variant: "error" })
            }
        }
    }, [])

    useEffect(() => {
        async function prefill() {
            const contentfulConfig = await framer.getPluginData("contentful")
            if (contentfulConfig) {
                setContentfulConfig(JSON.parse(contentfulConfig))
            }
        }

        prefill()
    }, [])

    const sync = async () => {
        console.log("handleContentfulSync")
        try {
            // // await framer.setPluginData("contentful:collections", "")
            // // In sync mode, we're already in a specific collection
            // const collection = await framer.getManagedCollection()
            // const contentTypeId = await collection.getPluginData("contentTypeId")
            // let collections = await framer.getPluginData("contentful:collections")
            // collections = collections ? JSON.parse(collections) : {}
            // collections[contentTypeId] = collection.id
            // console.log("collections", collections)
            // await framer.setPluginData("contentful:collections", JSON.stringify(collections))
            // if (!contentTypeId) {
            //     throw new Error("No content type configured")
            // }
            // // Initialize Contentful client for sync
            // // const spaceId = await collection.getPluginData("spaceId")
            // // const accessToken = await collection.getPluginData("accessToken")
            // const credentials = await framer.getPluginData("contentful")
            // if (!credentials) {
            //     throw new Error("Contentful credentials not found")
            // }
            // initContentful(JSON.parse(credentials))
            // console.log("contentTypeId", contentTypeId, collection.id)
            // const entries = await getEntriesForContentType(contentTypeId)
            // const mappedCollection = await mapContentfulToFramerCollection(contentTypeId, entries)
            // // empty the collection
            // const itemsIds = await collection.getItemIds()
            // await collection.removeItems(itemsIds)
            // // Update fields
            // await collection.setFields(mappedCollection.fields)
            // // Add/update items
            // await collection.addItems(mappedCollection.items)
            // framer.notify("Collection synchronized successfully", { variant: "success" })
            // if (process.env.NODE_ENV !== "development") {
            //     // keep the logs in development
            //     framer.closePlugin()
            // }
        } catch (error) {
            console.error("Failed to sync collection:", error)
            framer.notify(`Failed to sync collection, ${error instanceof Error ? error.message : "Unknown error"}`, {
                variant: "error",
            })
        }
    }

    const onSubmitPickContentType = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)

        const contentTypeId = (event.target as HTMLFormElement).contentType.value

        // if (!contentTypeId) {
        //     // throw new Error("Content type not found")
        //     framer.notify("Content type not found", { variant: "error" })
        //     return
        // }

        const contentType = contentTypes.find(ct => ct.sys.id === contentTypeId)

        if (!contentType) {
            // throw new Error("Content type not found")
            framer.notify("Content type not found", { variant: "error" })
            return
        }

        const collection = await framer.getManagedCollection()
        await collection.setPluginData("contentTypeId", contentTypeId)

        setContentType(contentType)

        console.log("contentType", contentType)

        setIsLoading(false)
    }

    const fetchContentTypes = async () => {
        const contentTypes = await getContentTypes()

        // Filter out content types with no entries
        const contentTypesWithEntries = await Promise.all(
            contentTypes.map(async contentType => {
                const entries = await getEntriesForContentType(contentType.sys.id)
                return entries.length > 0 ? contentType : null
            })
        )

        return contentTypesWithEntries.filter((ct): ct is NonNullable<typeof ct> => ct !== null)
    }

    const onSubmitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)

        try {
            initContentful(contentfulConfig)

            // Store the content type ID and Contentful credentials for future syncs

            framer.setPluginData("contentful", JSON.stringify(contentfulConfig))

            const collection = await framer.getManagedCollection()
            collection.setPluginData("contentful", JSON.stringify(contentfulConfig))

            const contentTypesWithEntries = await fetchContentTypes()

            // console.log("contentTypesWithEntries", JSON.stringify(contentTypesWithEntries, null, 2))
            setContentTypes(contentTypesWithEntries)
            setIsAuthenticated(true)
        } catch (error) {
            framer.notify("Failed to connect to Contentful", { variant: "error" })
            console.error("Failed to connect to Contentful", error)
        } finally {
            setIsLoading(false)
        }
    }

    const onSubmitFields = async (
        slugFieldId: string | null,
        mappedContentType: ExtendedManagedCollectionField[] | undefined
    ) => {
        console.log("onSubmitFields", slugFieldId, mappedContentType)

        if (!mappedContentType) {
            return
        }

        const collection = await framer.getManagedCollection()
        await collection.setFields(mappedContentType as ManagedCollectionField[])

        if (!contentType) {
            return
        }

        // add entries
        const entries = await getEntriesForContentType(contentType.sys.id)
        console.log("entries", entries)

        const mappedEntries = entries.map(entry => {
            return {
                id: entry.sys.id,
                slug: entry.fields[slugFieldId ?? ""],
                fieldData: Object.fromEntries(
                    Object.entries(entry.fields)
                        .filter(([id]) => mappedContentType.some(field => field.id === id))
                        .map(([id, value]) => {
                            const framerField = mappedContentType.find(field => field.id === id)

                            if (!framerField) {
                                console.log("framerField not found", id, value)
                                return [id, value]
                            }

                            console.log(id, value, framerField)

                            // @ts-expect-error Can't find the right type for the value
                            const mappedValue = mapContentfulValueToFramerValue(value, framerField)

                            return [id, mappedValue]
                        })
                ),
            }
        })

        console.log("mappedEntries", mappedEntries)

        // TODO: add only what is necessary

        await collection.addItems(mappedEntries as CollectionItemData[])
    }

    return (
        <div className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
            {process.env.NODE_ENV === "development" && (
                <>
                    <button
                        onClick={async () => {
                            // framer.setPluginData("contentful", "")

                            const collection = await framer.getManagedCollection()
                            await collection.setPluginData("contentTypeId", "")
                            await collection.setPluginData("contentful", "")
                            await framer.setPluginData("contentful:collections", "")

                            setContentfulConfig({ space: "", accessToken: "" })
                            setContentType(null)
                            // setMappedContentType(null)
                            setContentTypes([])
                            setIsAuthenticated(false)
                            // setSlugFieldId(null)

                            if (fieldsRef.current) {
                                fieldsRef.current.reset()
                            }
                        }}
                    >
                        reset
                    </button>

                    <button
                        onClick={async () => {
                            const collections = await framer.getPluginData("contentful:collections")
                            console.log("collections", collections)
                        }}
                    >
                        get collections
                    </button>
                </>
            )}
            {!isAuthenticated ? (
                <Auth
                    contentfulConfig={contentfulConfig}
                    setContentfulConfig={setContentfulConfig}
                    isLoading={isLoading}
                    onSubmit={onSubmitAuth}
                />
            ) : !contentType ? (
                <ContentTypePicker
                    onSubmit={onSubmitPickContentType}
                    contentTypes={contentTypes}
                    isLoading={isLoading}
                />
            ) : (
                <Fields ref={fieldsRef} contentType={contentType} onSubmit={onSubmitFields} />
            )}
        </div>
    )
}
