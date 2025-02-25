import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { Auth } from "./components/auth"
import { ContentTypePicker } from "./components/content-type-picker"
import { Fields } from "./components/fields"
import { CONTENT_TYPES, getContentType, initGreenhouse } from "./greenhouse"
import { CollectionField, CollectionItem, framer, ManagedCollectionField, Mode } from "framer-plugin"
import { useStore } from "./store"

// Main application component handling authentication, content type selection, and field mapping
export function App() {
    // State for tracking Greenhouse API initialization
    const [isGreenhouseInitialized, setIsGreenhouseInitialized] = useState<boolean>(false)
    // Delay mount to prevent flash of content
    const [isMounted, setIsMounted] = useState(false)
    const [mode] = useState<Mode>(framer.mode)

    // Global state from Zustand store
    const boardToken = useStore(state => state.boardToken)
    const setBoardToken = useStore(state => state.setBoardToken)
    const contentTypeId = useStore(state => state.contentTypeId)
    const setContentTypeId = useStore(state => state.setContentTypeId)
    const slugFieldId = useStore(state => state.slugFieldId)
    const setSlugFieldId = useStore(state => state.setSlugFieldId)

    useEffect(() => {
        const timeout = setTimeout(() => {
            setIsMounted(true)
        }, 1000)

        return () => clearTimeout(timeout)
    }, [])

    // Initialize Greenhouse API when board token changes
    useLayoutEffect(() => {
        if (boardToken) {
            initGreenhouse(boardToken)
                .then(() => {
                    setIsGreenhouseInitialized(true)
                    framer.setPluginData("greenhouse", boardToken)
                })
                .catch(() => {
                    setBoardToken("")
                    setIsGreenhouseInitialized(false)
                })
        }
    }, [boardToken, setBoardToken])

    // Sync function to update Framer collections with Greenhouse data
    const sync = useCallback(
        async (slugId: string | null = slugFieldId) => {
            if (!slugId || !contentTypeId) return

            const contentType = CONTENT_TYPES.find(contentType => contentType.id === contentTypeId)

            if (!contentType) {
                framer.notify(`Content type ${contentTypeId} not found`, {
                    variant: "error",
                    durationMs: 3000
                })
                return
            }

            // Show a notification that we're starting the sync process
            const syncNotification = framer.notify("Syncing data from Greenhouse...", {
                variant: "info",
                durationMs: 5000
            })

            try {
                const collection = await framer.getActiveManagedCollection()
                const fields = await collection.getFields()

                try {
                    const entries = await getContentType(contentTypeId)
                    
                    // Close the sync notification
                    syncNotification.close()

                    // Show success notification when content is fetched
                    framer.notify(`Successfully fetched ${entries.length} entries from Greenhouse`, {
                        variant: "success",
                        durationMs: 2000
                    })

                    // Show an import notification while processing entries
                    const importNotification = framer.notify("Processing and importing entries...", {
                        variant: "info",
                        durationMs: 5000
                    })

                    const mappedEntries = entries.map(entry => {
                        // @ts-expect-error: entry type is validated by content type selection
                        const mappedEntry = contentType.mapEntry(entry)

                        return {
                            id: mappedEntry.id,
                            slug: slugId === "id" ? `${mappedEntry.id}` : `${mappedEntry[slugId as keyof typeof mappedEntry]}-${mappedEntry.id}`,
                            fieldData: Object.fromEntries(
                                Object.entries(mappedEntry).filter(([key]) => fields.map(field => field.id).includes(key))
                            ),
                        }
                    })

                    const existingEntriesIds = await collection.getItemIds()
                    const entriesToBeRemoved = existingEntriesIds.filter(id => !mappedEntries.some(entry => entry.id === id))

                    await collection.addItems(mappedEntries as CollectionItem[])
                    await collection.removeItems(entriesToBeRemoved)

                    // Close the import notification
                    importNotification.close()

                    // Show success notification when data is synced
                    framer.notify(`Successfully imported ${mappedEntries.length} entries to your collection`, {
                        variant: "success",
                        durationMs: 2000
                    })

                    framer.closePlugin()
                } catch (error) {
                    console.error("Error fetching content type:", error)
                    
                    // Close the sync notification if it's still open
                    syncNotification.close()
                    
                    framer.notify(`Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`, {
                        variant: "error",
                        durationMs: 5000
                    })
                    
                    // If the error is related to the board token, reset it
                    if (error instanceof Error && 
                        (error.message.includes("token") || 
                         error.message.includes("API request failed") || 
                         error.message.includes("401") || 
                         error.message.includes("403"))) {
                        setBoardToken("")
                        setIsGreenhouseInitialized(false)
                    }
                }
            } catch (error) {
                console.error("Error accessing Framer collection:", error)
                
                // Close the sync notification if it's still open
                syncNotification.close()
                
                framer.notify(`Failed to access Framer collection: ${error instanceof Error ? error.message : String(error)}`, {
                    variant: "error",
                    durationMs: 5000
                })
            }
        },
        [slugFieldId, contentTypeId, setBoardToken]
    )

    // sync
    useEffect(() => {
        if (mode === "syncManagedCollection" && slugFieldId && contentTypeId && isGreenhouseInitialized) {
            sync()
        }
    }, [mode, isGreenhouseInitialized, sync, slugFieldId, contentTypeId])

    const onSubmitFields = async (slugId: string, fields: CollectionField[]) => {
        setSlugFieldId(slugId)

        const collection = await framer.getActiveManagedCollection()
        await collection.setFields(fields as ManagedCollectionField[])

        await sync(slugId)
    }

    if (mode === "syncManagedCollection") return
    if (!isMounted) return

    return (
        <>
            <div className="w-full px-[15px] flex flex-col flex-1 overflow-y-auto no-scrollbar">
                {!boardToken || !isGreenhouseInitialized ? (
                    <Auth onSubmit={setBoardToken} />
                ) : !contentTypeId ? (
                    <ContentTypePicker onSubmit={setContentTypeId} />
                ) : (
                    <Fields contentTypeId={contentTypeId} onSubmit={onSubmitFields} />
                )}
            </div>
        </>
    )
}
