import { ContentType, ContentTypeField } from "contentful"

// import "./App.css"
import { framer, ManagedCollectionField } from "framer-plugin"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { initContentful, getContentTypes, getEntriesForContentType } from "./contentful"
import { Auth } from "./components/auth"
import { ContentTypePicker } from "./components/content-type-picker"
import { CheckboxTextfield } from "./components/checkbox-text-field"
import cx from "classnames"
import { useInView } from "react-intersection-observer"

type CollectionFieldType = ManagedCollectionField["type"]
const FIELD_TYPE_OPTIONS: { type: CollectionFieldType; label: string }[] = [
    { type: "boolean", label: "Boolean" },
    { type: "color", label: "Color" },
    { type: "number", label: "Number" },
    { type: "string", label: "String" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "image", label: "Image" },
    { type: "link", label: "Link" },
    { type: "date", label: "Date" },
    { type: "enum", label: "Option" },
    { type: "file", label: "File" },
]

type ExtendedManagedCollectionField = ManagedCollectionField & {
    isDisabled?: boolean
    field?: ContentType
    isMissingReference?: boolean
}

async function getFramerFieldFromContentfulField(field: ContentTypeField): Promise<ExtendedManagedCollectionField> {
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
                const collectionId = collections?.[validationContentType]

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
                    const collectionId = collections?.[validationContentType]

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

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [contentfulConfig, setContentfulConfig] = useState({
        space: "", // "v1sdaxrypttu",
        accessToken: "", // "LNiCWA-oM2X5XeQXXTKa2uCQbHWy7tnUPMtoSioykEg",
    })
    const [contentTypes, setContentTypes] = useState<ContentType[]>([])
    const [isAuthenticated, setIsAuthenticated] = useState(false) // contentful space and access token are set and valid
    const [contentType, setContentType] = useState<ContentType | null>(null)
    const [slugFieldId, setSlugFieldId] = useState<string | null>(null)
    const [mappedContentType, setMappedContentType] = useState<ExtendedManagedCollectionField[] | null>(null)
    const filteredMappedContentType = useMemo(
        () => mappedContentType?.filter(({ isDisabled, isMissingReference }) => !isDisabled && !isMissingReference),
        [mappedContentType]
    )

    const { ref: scrollRef, inView: isAtBottom } = useInView({ threshold: 1 })

    useEffect(() => {
        async function mapContentType() {
            if (contentType) {
                const mappedContentType = await Promise.all(
                    contentType.fields.map(async field => {
                        const framerField = await getFramerFieldFromContentfulField(field)

                        return {
                            ...framerField,
                            isDisabled: false,
                            field,
                        }
                    })
                )
                setMappedContentType(mappedContentType)
                setSlugFieldId(mappedContentType.find(field => field.type === "string")?.id ?? null)
            }
        }

        mapContentType()
    }, [contentType])

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

        const collectionsList = await framer.getPluginData("contentful:collections")
        const collections = collectionsList ? JSON.parse(collectionsList) : {}
        collections[contentTypeId] = collection.id
        await framer.setPluginData("contentful:collections", JSON.stringify(collections))

        setContentType(contentType)

        console.log("contentType", contentType)
        // setContentType(contentTypeId)

        // await importContentType(contentTypeId)

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

    useEffect(() => {
        console.log("contentType", contentType)
        console.log("filteredMappedContentType", filteredMappedContentType)
        // console.log("slugFieldId", slugFieldId)
    }, [filteredMappedContentType, contentType])

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
                            // await framer.setPluginData("contentful:collections", "")

                            setContentfulConfig({ space: "", accessToken: "" })
                            setContentType(null)
                            setMappedContentType(null)
                            setContentTypes([])
                            setIsAuthenticated(false)
                            setSlugFieldId(null)
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
            ) : !mappedContentType ? (
                <ContentTypePicker
                    onSubmit={onSubmitPickContentType}
                    contentTypes={contentTypes}
                    isLoading={isLoading}
                />
            ) : (
                <form className="col gap-2 flex-1 text-tertiary">
                    <div className="h-px border-b border-divider mb-2 sticky top-0" />
                    <div className="flex flex-col gap-4 h-fit">
                        <div className="flex flex-col gap-2 w-full">
                            <label htmlFor="collectionName">Slug Field</label>
                            <select
                                className="w-full"
                                value={slugFieldId ?? ""}
                                onChange={e => setSlugFieldId(e.target.value)}
                                required
                            >
                                {filteredMappedContentType
                                    ?.filter(({ type }) => type === "string")
                                    .map(({ id, name }) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols items-center grid-cols-fieldPicker gap-2.5 mb-auto overflow-hidden">
                        <span className="col-span-2">Column</span>
                        <span>Field</span>
                        <span>Type</span>

                        {mappedContentType
                            .sort((a, b) => (a.isMissingReference ? 1 : b.isMissingReference ? -1 : 0))
                            .map(({ name, type, id, isDisabled, isMissingReference, field }, index) => (
                                <Fragment key={id}>
                                    <CheckboxTextfield
                                        disabled={Boolean(isMissingReference)} // if reference doesn't exist, disable the field
                                        value={field?.name ?? ""}
                                        checked={!isDisabled && !isMissingReference}
                                        onChange={() => {
                                            setMappedContentType(prev => {
                                                if (!prev) return prev

                                                const newMappedContentType = structuredClone(prev)
                                                newMappedContentType[index].isDisabled =
                                                    !newMappedContentType[index].isDisabled

                                                return newMappedContentType
                                            })
                                        }}
                                    />
                                    <div className="flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16">
                                            <path
                                                d="M 3 11 L 6 8 L 3 5"
                                                fill="transparent"
                                                stroke-width="1.5"
                                                stroke="#999"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        className={cx("w-full", {
                                            "opacity-50": isDisabled || isMissingReference,
                                        })}
                                        placeholder={name}
                                        value={isMissingReference ? "Missing reference" : name}
                                        disabled={isDisabled || isMissingReference}
                                        onChange={e => {
                                            setMappedContentType(prev => {
                                                if (!prev) return prev

                                                const newMappedContentType = structuredClone(prev)
                                                newMappedContentType[index].name = e.target.value

                                                return newMappedContentType
                                            })
                                        }}
                                    />
                                    <select
                                        className={cx("w-full", {
                                            "opacity-50": isDisabled || isMissingReference,
                                        })}
                                        value={type}
                                        disabled={isDisabled || isMissingReference}
                                        onChange={e => {
                                            setMappedContentType(prev => {
                                                if (!prev) return prev

                                                const newMappedContentType = structuredClone(prev)
                                                newMappedContentType[index].type = e.target.value as CollectionFieldType

                                                return newMappedContentType
                                            })
                                        }}
                                    >
                                        {FIELD_TYPE_OPTIONS.map(({ type, label }) => (
                                            <option value={type}>{label}</option>
                                        ))}
                                    </select>
                                </Fragment>
                            ))}
                        {mappedContentType.length > 6 && !isAtBottom && <div className="scroll-fade"></div>}
                        <div ref={scrollRef} className="h-0 w-0"></div>
                    </div>
                    <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 border-t border-divider border-opacity-20 items-center max-w-full">
                        <button type="submit" className="w-full">{`Import from ${contentType?.name}`}</button>
                    </div>
                </form>
            )}
        </div>
    )
}
