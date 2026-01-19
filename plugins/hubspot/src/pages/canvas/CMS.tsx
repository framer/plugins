import { framer, useIsAllowedTo } from "framer-plugin"
import { useEffect, useState } from "react"
import { Button } from "../../components/Button"
import { CenteredSpinner } from "../../components/CenteredSpinner"
import { CMSCollectionIcon } from "../../components/Icons"
import { ScrollFadeContainer } from "../../components/ScrollFadeContainer"

export default function CMSPage() {
    const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const isAllowedToCreateCollection = useIsAllowedTo("createManagedCollection")

    useEffect(() => {
        const loadCollections = async () => {
            try {
                const allCollections = await framer.getCollections()
                const thisPluginCollections = allCollections
                    .filter(collection => collection.managedBy === "thisPlugin")
                    .map(collection => ({
                        id: collection.id,
                        name: collection.name,
                    }))
                setCollections(thisPluginCollections)
            } catch (error) {
                console.error("Failed to load collections:", error)
                framer.notify("Failed to load collections", { variant: "error" })
            } finally {
                setIsLoading(false)
            }
        }

        void loadCollections()
    }, [])

    const handleCollectionClick = async (collectionId: string) => {
        try {
            await framer.navigateTo(collectionId)
        } catch (error) {
            console.error("Failed to navigate to collection:", error)
            framer.notify("Failed to open collection", { variant: "error" })
        }
    }

    const handleCreateCollection = async () => {
        if (!isAllowedToCreateCollection) {
            framer.notify("You are not allowed to create collections", { variant: "error" })
            return
        }

        try {
            setIsCreating(true)
            const name = await findAvailableCollectionName("HubSpot")
            const collection = await framer.createManagedCollection(name)
            framer.notify("Created a new collection. Click Sync to sync data from HubSpot.")
            await framer.navigateTo(collection.id)
        } catch (error) {
            console.error("Failed to create collection:", error)
            framer.notify(`Failed to create collection: ${error instanceof Error ? error.message : "Unknown error"}`, {
                variant: "error",
            })
        } finally {
            setIsCreating(false)
        }
    }

    if (isLoading) return <CenteredSpinner />

    return (
        <div className="flex flex-col gap-0 h-full p-[15px]">
            {collections.length > 0 ? (
                <ScrollFadeContainer className="col flex-1 gap-0" height={226}>
                    {collections.map(collection => (
                        <div
                            key={collection.id}
                            className="h-[30px] text-secondary hover:text-primary cursor-pointer px-[10px] flex flex-row items-center hover:bg-tertiary rounded-lg gap-2"
                            onClick={() => void handleCollectionClick(collection.id)}
                        >
                            <CMSCollectionIcon />
                            <span>{collection.name}</span>
                        </div>
                    ))}
                </ScrollFadeContainer>
            ) : (
                <div className="flex justify-center items-center flex-1">
                    <p className="text-tertiary text-center max-w-[200px]">
                        No HubSpot collections yet. Create one to get started.
                    </p>
                </div>
            )}

            <div className="col-lg sticky top-0 left-0">
                <hr />
                <Button
                    className="w-full"
                    onClick={() => void handleCreateCollection()}
                    isLoading={isCreating}
                    disabled={!isAllowedToCreateCollection}
                    title={isAllowedToCreateCollection ? undefined : "Insufficient permissions"}
                >
                    Create New Collection
                </Button>
            </div>
        </div>
    )
}

async function findAvailableCollectionName(baseName: string): Promise<string> {
    const collections = await framer.getCollections()
    const existingNames = new Set(collections.map(c => c.name))

    // Check if base name is available
    if (!existingNames.has(baseName)) {
        return baseName
    }

    // Try numbered variants: "HubSpot 2", "HubSpot 3", etc.
    let counter = 2
    let candidateName = `${baseName} ${counter}`
    while (existingNames.has(candidateName)) {
        counter++
        candidateName = `${baseName} ${counter}`
    }

    return candidateName
}
