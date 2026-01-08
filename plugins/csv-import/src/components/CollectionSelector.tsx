import type { Collection } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { type ChangeEvent, useEffect, useRef, useState } from "react"

interface CollectionSelectorProps {
    forceCreate?: boolean
    collection: Collection | null
    onCollectionChange: (collection: Collection) => void
}

const NEW_COLLECTION_VALUE = "__new_collection__"

export function CollectionSelector({ forceCreate, collection, onCollectionChange }: CollectionSelectorProps) {
    const isAllowedToCreateCollection = useIsAllowedTo("createCollection")
    const collections = useCollections(collection)
    const [isCreatingNew, setIsCreatingNew] = useState(forceCreate)
    const [newCollectionName, setNewCollectionName] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isCreatingNew && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isCreatingNew])

    const selectCollection = async (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value

        if (value === NEW_COLLECTION_VALUE) {
            setIsCreatingNew(true)
            setNewCollectionName("")
            return
        }

        const selectedCollection = collections.find(c => c.id === value)
        if (!selectedCollection) return

        await selectedCollection.setAsActive()
        onCollectionChange(selectedCollection)
    }

    const handleCreateCollection = async () => {
        const trimmedName = newCollectionName.trim()
        if (!trimmedName) return

        const newCollection = await framer.createCollection(trimmedName)
        await newCollection.setAsActive()
        onCollectionChange(newCollection)
        setIsCreatingNew(false)
        setNewCollectionName("")
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setIsCreatingNew(false)
            setNewCollectionName("")
        } else if (event.key === "Enter") {
            event.preventDefault()
            void handleCreateCollection()
        }
    }

    if (isCreatingNew) {
        return (
            <div className="collection-selector">
                <input
                    ref={inputRef}
                    type="text"
                    className="collection-select"
                    value={newCollectionName}
                    onChange={e => {
                        setNewCollectionName(e.target.value)
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        if (newCollectionName.trim()) {
                            void handleCreateCollection()
                        }
                    }}
                    placeholder="Collection name"
                />
            </div>
        )
    }

    return (
        <div className="collection-selector">
            <select
                className="collection-select"
                value={collection?.id ?? ""}
                onChange={e => void selectCollection(e)}
                autoFocus
            >
                {!collection && (
                    <option value="" disabled>
                        Select Collection…
                    </option>
                )}

                {isAllowedToCreateCollection && <option value={NEW_COLLECTION_VALUE}>New Collection...</option>}

                {collections.length > 0 && <option disabled>──────────</option>}
                {collections.length > 0 &&
                    collections.map(collection => (
                        <option key={collection.id} value={collection.id}>
                            {collection.name}
                        </option>
                    ))}
            </select>
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
