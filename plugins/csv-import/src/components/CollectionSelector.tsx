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
const DEFAULT_COLLECTION_NAME = "Collection"

export function CollectionSelector({ forceCreate, collection, onCollectionChange }: CollectionSelectorProps) {
    const isAllowedToCreateCollection = useIsAllowedTo("createCollection")
    const { writableCollections, allCollections } = useCollections(collection)
    const [isCreatingNew, setIsCreatingNew] = useState(forceCreate)
    const [creationError, setCreationError] = useState<string | undefined>(undefined)
    const [newCollectionName, setNewCollectionName] = useState(DEFAULT_COLLECTION_NAME)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isCreatingNew && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isCreatingNew])

    // Find available collection name when starting to create a new collection
    useEffect(() => {
        if (isCreatingNew && allCollections.length > 0) {
            const availableName = findAvailableCollectionName(DEFAULT_COLLECTION_NAME, allCollections)
            setNewCollectionName(availableName)
            setCreationError(undefined)
        }
    }, [isCreatingNew, allCollections])

    // Validate for duplicates on initial render and when collections change
    // Only show error if user has manually changed the name from the auto-generated one
    useEffect(() => {
        if (isCreatingNew) {
            const trimmedName = newCollectionName.trim()
            if (trimmedName) {
                const isDuplicate = allCollections.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())
                if (isDuplicate) {
                    setCreationError("Name already exists")
                } else {
                    setCreationError(undefined)
                }
            } else {
                setCreationError(undefined)
            }
        }
    }, [isCreatingNew, newCollectionName, allCollections])

    const selectCollection = async (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value

        if (value === NEW_COLLECTION_VALUE) {
            setIsCreatingNew(true)
            const availableName = findAvailableCollectionName(DEFAULT_COLLECTION_NAME, allCollections)
            setNewCollectionName(availableName)
            return
        }

        const selectedCollection = writableCollections.find(c => c.id === value)
        if (!selectedCollection) return

        await selectedCollection.setAsActive()
        onCollectionChange(selectedCollection)
    }

    const createCollection = async () => {
        const trimmedName = newCollectionName.trim()
        if (!trimmedName) return

        // Check for duplicates before attempting to create
        const isDuplicate = allCollections.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())
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

        setCreationError(undefined)

        await newCollection.setAsActive()
        onCollectionChange(newCollection)
        setIsCreatingNew(false)
        setNewCollectionName(DEFAULT_COLLECTION_NAME)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setIsCreatingNew(false)
            setNewCollectionName(DEFAULT_COLLECTION_NAME)
            setCreationError(undefined)
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
            const isDuplicate = allCollections.some(c => c.name.toLowerCase() === trimmedValue.toLowerCase())
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

                {writableCollections.length > 0 && <hr />}
                {writableCollections.map(collection => (
                    <option key={collection.id} value={collection.id}>
                        {collection.name}
                    </option>
                ))}
            </select>
        </div>
    )
}

function useCollections(collection: Collection | null) {
    const [allCollections, setAllCollections] = useState<Collection[]>([])

    useEffect(() => {
        const abortController = new AbortController()

        const task = async () => {
            try {
                const collections = await framer.getCollections()

                // Check if component was unmounted before setting state
                if (abortController.signal.aborted) return

                setAllCollections(collections)
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

    return {
        writableCollections: allCollections.filter(collection => collection.managedBy === "user"),
        allCollections,
    }
}

function findAvailableCollectionName(baseName: string, allCollections: Collection[]): string {
    const existingNames = new Set(allCollections.map(c => c.name))

    // Check if base name is available
    if (!existingNames.has(baseName)) {
        return baseName
    }

    // Try numbered variants: "Collection 2", "Collection 3", etc.
    let counter = 2
    let candidateName = `${baseName} ${counter}`
    while (existingNames.has(candidateName)) {
        counter++
        candidateName = `${baseName} ${counter}`
    }

    return candidateName
}
