import type { Collection } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { type ChangeEvent, useEffect, useState } from "react"
import { PlusIcon } from "./PlusIcon"

interface CollectionSelectorProps {
    collection: Collection | null
    onCollectionChange: (collection: Collection) => void
    onCreateCollection: () => void
}

export function CollectionSelector({ collection, onCollectionChange, onCreateCollection }: CollectionSelectorProps) {
    const isAllowedToCreateCollection = useIsAllowedTo("createCollection")
    const collections = useCollections(collection)

    const selectCollection = async (event: ChangeEvent<HTMLSelectElement>) => {
        const selectedCollection = collections.find(c => c.id === event.currentTarget.value)
        if (!selectedCollection) return

        await selectedCollection.setAsActive()
        onCollectionChange(selectedCollection)
    }

    return (
        <div className="collection-selector">
            <select
                className="collection-select"
                value={collection?.id ?? ""}
                onChange={e => void selectCollection(e)}
                autoFocus
            >
                <option value="" disabled>
                    Select Collection…
                </option>

                {collections.map(collection => (
                    <option key={collection.id} value={collection.id}>
                        {collection.name}
                    </option>
                ))}
            </select>

            {isAllowedToCreateCollection && (
                <button
                    type="button"
                    className="create-collection-button"
                    onClick={onCreateCollection}
                    title="Create new collection"
                >
                    <span className="create-collection-icon">
                        <PlusIcon />
                    </span>
                </button>
            )}
        </div>
    )
}

function useCollections(collection: Collection | null) {
    const [collections, setCollections] = useState<Collection[]>([])
    useEffect(() => {
        const abortController = new AbortController()

        const task = async () => {
            try {
                const collections = await framer.getCollections()

                // Check if component was unmounted before setting state
                if (abortController.signal.aborted) return

                const writableCollections = collections.filter(collection => collection.managedBy === "user")
                setCollections(writableCollections)
            } catch (error) {
                // Only handle error if component is still mounted
                if (abortController.signal.aborted) return

                console.error(error)
                framer.notify("Failed to load collections", { variant: "error" })
            }
        }

        void task()

        return () => {
            abortController.abort()
        }
    }, [collection])

    return collections
}
