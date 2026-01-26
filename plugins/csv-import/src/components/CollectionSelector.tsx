import type { Collection } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { CollectionIcon } from "./CollectionIcon"

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
    const [creationError, setCreationError] = useState<string | undefined>(undefined)
    const [newCollectionName, setNewCollectionName] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isCreatingNew && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isCreatingNew])

    // Validate for duplicates on initial render and when collections change
    // Only show error if user has manually changed the name from the auto-generated one
    useEffect(() => {
        if (isCreatingNew) {
            const trimmedName = newCollectionName.trim()
            if (trimmedName) {
                const isDuplicate = collections.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())
                if (isDuplicate) {
                    setCreationError("Name already exists")
                } else {
                    setCreationError(undefined)
                }
            } else {
                setCreationError(undefined)
            }
        }
    }, [isCreatingNew, newCollectionName, collections])

    const cancelCreatingNewCollection = () => {
        setIsCreatingNew(false)
        setNewCollectionName("")
        setCreationError(undefined)
    }

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

    const createCollection = async () => {
        const trimmedName = newCollectionName.trim()
        if (!trimmedName) return

        // Check for duplicates before attempting to create
        const isDuplicate = collections.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())
        if (isDuplicate) {
            setCreationError("Name already exists")
            return
        }

        let newCollection: Collection
        try {
            newCollection = await framer.createCollection(trimmedName)
        } catch (error) {
            if (/collection.*already exists/.test(String(error))) {
                setCreationError("Name already exists")
            } else {
                setCreationError("Unknown error")
            }

            throw error
        }

        await newCollection.setAsActive()
        onCollectionChange(newCollection)
        cancelCreatingNewCollection()
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            cancelCreatingNewCollection()
        } else if (event.key === "Enter") {
            event.preventDefault()
            void createCollection()
        }
    }

    function handleCollectionNameChange(e: ChangeEvent<HTMLInputElement>) {
        const value = e.target.value
        setNewCollectionName(value)

        // Validate for duplicate names while typing
        const trimmedValue = value.trim()
        if (trimmedValue) {
            const isDuplicate = collections.some(c => c.name.toLowerCase() === trimmedValue.toLowerCase())
            if (isDuplicate) {
                setCreationError("Name already exists")
            } else {
                setCreationError(undefined)
            }
        } else {
            setCreationError(undefined)
        }
    }

    if (isCreatingNew) {
        return (
            <div className="collection-creation-container">
                <div className="collection-selector">
                    <div className="collection-icon-container">
                        <CollectionIcon />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        className={creationError ? "collection-select error" : "collection-select"}
                        value={newCollectionName}
                        onChange={handleCollectionNameChange}
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            if (newCollectionName.trim()) {
                                void createCollection()
                            } else {
                                cancelCreatingNewCollection()
                            }
                        }}
                        placeholder="Enter new collection name..."
                    />
                </div>

                {creationError && <div className="error-message">{creationError}</div>}
            </div>
        )
    }

    return (
        <div className="collection-selector">
            <div className="collection-icon-container">
                <CollectionIcon />
            </div>

            <select className="collection-select" value={collection?.id ?? ""} onChange={e => void selectCollection(e)}>
                {!collection && (
                    <option value="" disabled>
                        Select Collection…
                    </option>
                )}

                {isAllowedToCreateCollection && <option value={NEW_COLLECTION_VALUE}>New Collection...</option>}

                {collections.length > 0 && <hr />}
                {collections.map(collection => (
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
