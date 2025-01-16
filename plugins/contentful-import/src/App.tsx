import { ContentType } from "contentful"

import "./App.css"
import { framer } from "framer-plugin"
import { useEffect, useState } from "react"
import {
    initContentful,
    getContentTypes,
    getEntriesForContentType,
    mapContentfulToFramerCollection,
} from "./contentful"

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [contentfulConfig, setContentfulConfig] = useState({
        space: "", // "v1sdaxrypttu",
        accessToken: "", // "LNiCWA-oM2X5XeQXXTKa2uCQbHWy7tnUPMtoSioykEg",
    })
    const [contentfulContentTypes, setContentfulContentTypes] = useState<ContentType[]>([])
    const [isConfigured, setIsConfigured] = useState(false)

    useEffect(() => {
        async function configure() {
            const collection = await framer.getManagedCollection()
            const contentTypeId = await collection.getPluginData("contentTypeId")

            console.log("contentTypeId", contentTypeId)

            if (contentTypeId) {
                // edit mode
                // retrieve content types from Contentful
                // show UI
                return
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
            handleContentfulSync()
        } else {
            if (framer.mode === "configureManagedCollection") {
                console.log("configureManagedCollection")
            }

            configure()
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

    const handleContentfulSync = async () => {
        console.log("handleContentfulSync")
        try {
            // In sync mode, we're already in a specific collection
            const collection = await framer.getManagedCollection()
            const contentTypeId = await collection.getPluginData("contentTypeId")

            if (!contentTypeId) {
                throw new Error("No content type configured")
            }

            // Initialize Contentful client for sync
            const spaceId = await collection.getPluginData("spaceId")
            const accessToken = await collection.getPluginData("accessToken")
            if (!spaceId || !accessToken) {
                throw new Error("Contentful credentials not found")
            }
            initContentful({ space: spaceId, accessToken })

            const entries = await getEntriesForContentType(contentTypeId)
            const mappedCollection = await mapContentfulToFramerCollection(contentTypeId, entries)

            // empty the collection
            const itemsIds = await collection.getItemIds()
            await collection.removeItems(itemsIds)

            // Update fields
            await collection.setFields(mappedCollection.fields)

            // Add/update items
            await collection.addItems(mappedCollection.items)

            framer.notify("Collection synchronized successfully", { variant: "success" })
            framer.closePlugin()
        } catch (error) {
            console.error("Failed to sync collection:", error)
            framer.notify("Failed to sync collection", { variant: "error" })
        }
    }

    const handleContentfulConfig = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)

        try {
            initContentful(contentfulConfig)
            framer.setPluginData("contentful", JSON.stringify(contentfulConfig))
            const contentTypes = await getContentTypes()
            console.log(
                "Available content types:",
                contentTypes.map(ct => ({
                    id: ct.sys.id,
                    name: ct.name,
                    fields: ct.fields.map(f => ({
                        id: f.id,
                        name: f.name,
                        type: f.type,
                    })),
                }))
            )

            // Filter out content types with no entries
            const contentTypesWithEntries = await Promise.all(
                contentTypes.map(async contentType => {
                    const entries = await getEntriesForContentType(contentType.sys.id)
                    // console.log(
                    //     `Content type ${contentType.name} (${contentType.sys.id}) has ${entries.length} entries`
                    // )
                    return entries.length > 0 ? contentType : null
                })
            )

            setContentfulContentTypes(contentTypesWithEntries.filter((ct): ct is NonNullable<typeof ct> => ct !== null))
            setIsConfigured(true)
        } catch (error) {
            framer.notify("Failed to connect to Contentful", { variant: "error" })
            console.error("Failed to connect to Contentful", error)
        } finally {
            setIsLoading(false)
        }
    }

    const importContentfulData = async (contentTypeId: string) => {
        setIsLoading(true)
        try {
            console.log("Importing contentful data for content type ID:", contentTypeId)

            // Find the content type info
            const contentType = contentfulContentTypes.find(ct => ct.sys.id === contentTypeId)
            if (!contentType) {
                throw new Error("Content type not found")
            }

            // Get a new managed collection for this content type
            const collection = await framer.getManagedCollection()
            console.log("Got collection for", contentType.name)

            const entries = await getEntriesForContentType(contentTypeId)
            console.log("Got entries from Contentful:", entries.length)

            const mappedCollection = await mapContentfulToFramerCollection(contentTypeId, entries)
            console.log("Mapped collection:", {
                contentTypeId,
                contentTypeName: contentType.name,
                fields: mappedCollection.fields.map(f => ({
                    id: f.id,
                    name: f.name,
                    type: f.type,
                })),
                items: mappedCollection.items.length,
            })

            // Store the content type ID and Contentful credentials for future syncs
            await collection.setPluginData("contentTypeId", contentTypeId)
            await collection.setPluginData("spaceId", contentfulConfig.space)
            await collection.setPluginData("accessToken", contentfulConfig.accessToken)
            console.log("Stored content type ID and credentials")

            // Clear any existing fields and items
            const existingFields = await collection.getFields()
            if (existingFields.length > 0) {
                await collection.setFields([])
                await collection.addItems([])
            }

            // Set up fields
            await collection.setFields(mappedCollection.fields)
            console.log("Set collection fields")

            // Add items
            await collection.addItems(mappedCollection.items)
            console.log("Added collection items")

            framer.notify(`Imported ${contentType.name} successfully`, { variant: "success" })
        } catch (error) {
            console.error("Failed to import collection:", error)
            if (error instanceof Error) {
                framer.notify(`Import failed: ${error.message}`, { variant: "error" })
            } else {
                framer.notify("Failed to import collection", { variant: "error" })
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="export-collection">
            {!isConfigured ? (
                <form onSubmit={handleContentfulConfig} className="contentful-config">
                    <h2>Configure Contentful</h2>
                    <input
                        type="text"
                        placeholder="Space ID"
                        value={contentfulConfig.space}
                        onChange={e => setContentfulConfig(prev => ({ ...prev, space: e.target.value }))}
                        required
                        disabled={isLoading}
                    />
                    <input
                        type="text"
                        placeholder="Access Token"
                        value={contentfulConfig.accessToken}
                        onChange={e => setContentfulConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                        required
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? "Connecting..." : "Connect"}
                    </button>
                </form>
            ) : (
                <>
                    <div className="contentful-content-types">
                        <h3>Available Content Types</h3>
                        <div className="content-type-list">
                            {isLoading ? (
                                <p>Loading content types...</p>
                            ) : contentfulContentTypes.length === 0 ? (
                                <p>No content types with entries found</p>
                            ) : (
                                contentfulContentTypes.map(contentType => (
                                    <button
                                        key={contentType.sys.id}
                                        onClick={() => importContentfulData(contentType.sys.id)}
                                        className="content-type-button"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Importing..." : `Import ${contentType.name}`}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
