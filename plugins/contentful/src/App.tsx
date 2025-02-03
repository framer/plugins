import { ContentType } from "contentful"
import { CollectionItem, framer, ManagedCollectionField } from "framer-plugin"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { initContentful, getContentTypes, getEntriesForContentType, getContentType } from "./contentful"
import { Auth } from "./components/auth"
import { ContentTypePicker } from "./components/content-type-picker"
import { Fields } from "./components/fields"
import { mapContentfulValueToFramerValue } from "./utils"
import { ExtendedManagedCollectionField, getFramerFieldFromContentfulField } from "./utils"

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [contentfulConfig, setContentfulConfig] = useState({
        space: "",
        accessToken: "",
    })
    const [contentTypes, setContentTypes] = useState<ContentType[]>([])
    const [isAuthenticated, setIsAuthenticated] = useState(false) // contentful space and access token are set and valid
    const [contentType, setContentType] = useState<ContentType | null>(null)

    useEffect(() => {
        async function cache() {
            const collectionsList = await framer.getPluginData("contentful:collections")
            const collections = collectionsList ? JSON.parse(collectionsList) : {}
            const framerCollections = await framer.getCollections()

            // console.log("collections", collections)
            // console.log("framerCollections", framerCollections)

            Object.entries(collections).forEach(([key, value]) => {
                if (!framerCollections.find(({ id }) => id === value?.id)) {
                    console.log("delete collection", key)
                    delete collections[key]
                }
            })

            await framer.setPluginData("contentful:collections", JSON.stringify(collections))

            const contentTypeId = contentType?.sys?.id

            if (!contentTypeId) return

            const collection = await framer.getManagedCollection()

            collections[contentTypeId] = collection
            await framer.setPluginData("contentful:collections", JSON.stringify(collections))
        }

        if (contentType) {
            cache()
        }
    }, [contentType])

    const fieldsRef = useRef<{ reset: () => void } | null>(null)

    const hasTriggeredSyncRef = useRef(false)

    useLayoutEffect(() => {
        async function prefill() {
            const contentfulConfig = await framer.getPluginData("contentful")
            if (contentfulConfig) {
                setContentfulConfig(JSON.parse(contentfulConfig))
            }
        }

        prefill()
    }, [])

    useLayoutEffect(() => {
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

            setIsLoading(false)
        }

        if (framer.mode === "syncManagedCollection") {
            // When in sync mode, don't show UI
            if (!hasTriggeredSyncRef.current) {
                sync()
                hasTriggeredSyncRef.current = true
            }
        } else {
            try {
                configure()
            } catch (error) {
                console.error("Failed to configure Contentful plugin:", error)
                framer.notify("Failed to configure Contentful plugin", { variant: "error" })
            }
        }
    }, [])

    const sync = async () => {
        const collection = await framer.getManagedCollection()
        const fields = await collection.getFields()
        const slugFieldId = await collection.getPluginData("slugFieldId")
        const contentTypeId = await collection.getPluginData("contentTypeId")

        if (!slugFieldId || !contentTypeId) {
            return
        }

        const credentials = await collection.getPluginData("contentful")
        if (credentials) {
            initContentful(JSON.parse(credentials))
        }

        const contentType = await getContentType(contentTypeId)

        const existingMappedContentType = fields.map(framerField => {
            return {
                ...framerField,
                field: contentType.fields.find(field => field.id === framerField.id),
            }
        })

        let mappedContentType = await Promise.all(
            contentType.fields.map(async field => {
                const framerField = await getFramerFieldFromContentfulField(field)

                return {
                    ...framerField,
                    field,
                    defaultType: framerField.type,
                    collectionId: framerField.collectionId,
                }
            })
        )

        mappedContentType = mappedContentType
            .map(field => {
                const existingField = existingMappedContentType.find(existingField => existingField.id === field.id)

                if (existingField) {
                    field = { ...field, ...existingField }
                }

                if (!existingField) {
                    field.isDisabled = true
                }

                return field
            })
            .filter(field => field.isDisabled !== true)

        const entries = await getEntriesForContentType(contentTypeId)

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
                                return [id, value]
                            }

                            // @ts-expect-error Can't find the right type for the value
                            const mappedValue = mapContentfulValueToFramerValue(value, framerField)

                            return [id, mappedValue]
                        })
                ),
            }
        })

        console.log("Added entries:", mappedEntries)

        // if (hardRefresh) {
        //     const ids = await collection.getItemIds()
        //     await collection.removeItems(ids)
        //     await collection.addItems(mappedEntries as CollectionItem[])
        // } else {
        const existingEntriesIds = await collection.getItemIds()

        // const entriesToBeAdded = mappedEntries.filter(entry => !existingEntriesIds.includes(entry.id))
        const entriesToBeRemoved = existingEntriesIds.filter(id => !mappedEntries.some(entry => entry.id === id))
        const order = entries.map(entry => entry.sys.id)

        // TODO: detect if fields has changed

        await collection.addItems(mappedEntries as CollectionItem[])
        await collection.removeItems(entriesToBeRemoved)
        await collection.setItemOrder(order)
        // }

        // try {
        // } catch (error) {
        //     console.error("Failed to sync collection:", error)
        //     framer.notify(`Failed to sync collection, ${error instanceof Error ? error.message : "Unknown error"}`, {
        //         variant: "error",
        //     })
        // }

        // framer.closePlugin()
    }

    const onSubmitPickContentType = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)

        const contentTypeId = (event.target as HTMLFormElement).contentType.value

        const contentType = contentTypes.find(ct => ct.sys.id === contentTypeId)

        if (!contentType) {
            // throw new Error("Content type not found")
            framer.notify("Content type not found", { variant: "error" })
            return
        }

        const collection = await framer.getManagedCollection()
        await collection.setPluginData("contentTypeId", contentTypeId)

        setContentType(contentType)

        // console.log("contentType", contentType)

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
        filteredMappedContentType: ExtendedManagedCollectionField[] | undefined
    ) => {
        if (!slugFieldId || !filteredMappedContentType) {
            return
        }

        setIsLoading(true)

        const collection = await framer.getManagedCollection()
        collection.setPluginData("slugFieldId", slugFieldId)

        console.log("Added fields:", filteredMappedContentType)

        // const fields = await collection.getFields()

        const newFields = filteredMappedContentType.map(field => {
            return {
                id: field.id,
                name: field.name,
                type: field.type,
                userEditable: field.userEditable,
                collectionId: field.collectionId,
            }
        })

        await collection.setFields(newFields as ManagedCollectionField[])

        // const hardRefresh =
        //     newFields.length !== fields.length ||
        //     newFields.some(field => field.type !== fields.find(f => f.id === field.id)?.type)

        await sync()

        setIsLoading(false)
    }

    if (framer.mode === "syncManagedCollection") {
        return
    }

    return (
        <div className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
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
                <Fields ref={fieldsRef} contentType={contentType} onSubmit={onSubmitFields} isLoading={isLoading} />
            )}
        </div>
    )
}
