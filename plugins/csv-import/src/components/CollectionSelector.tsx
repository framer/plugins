import type { Collection } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { CheckIcon } from "./CheckIcon"
import { PlusIcon } from "./PlusIcon"

interface CollectionSelectorProps {
    collection: Collection | null
    onCollectionChange: (collection: Collection) => void
}

export function CollectionSelector({ collection, onCollectionChange }: CollectionSelectorProps) {
    const isAllowedToCreateCollection = useIsAllowedTo("createCollection")
    const collections = useCollections(collection)

    const [showCreateCollectionLine, setShowCreateCollectionLine] = useState(false)
    const [newCollectionName, setNewCollectionName] = useState("")
    const createCollectionSectionRef = useRef<HTMLDivElement>(null)
    const createCollectionInputRef = useRef<HTMLInputElement>(null)

    const selectCollection = async (event: ChangeEvent<HTMLSelectElement>) => {
        const selectedCollection = collections.find(c => c.id === event.currentTarget.value)
        if (!selectedCollection) return

        await selectedCollection.setAsActive()
        onCollectionChange(selectedCollection)
    }

    const handleCreateCollectionSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        const trimmedName = newCollectionName.trim()
        if (trimmedName) {
            const newCollection = await framer.createCollection(trimmedName)

            await newCollection.setAsActive()

            onCollectionChange(newCollection)
            setShowCreateCollectionLine(false)
            setNewCollectionName("")
        }
    }

    useEffect(() => {
        if (showCreateCollectionLine) {
            createCollectionInputRef.current?.focus()
        }
    }, [showCreateCollectionLine])

    return (
        <>
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
                        onClick={() => {
                            if (showCreateCollectionLine) {
                                setShowCreateCollectionLine(false)
                                setNewCollectionName("")
                            } else {
                                setShowCreateCollectionLine(true)
                            }
                        }}
                        title={showCreateCollectionLine ? "Cancel" : "Create new collection"}
                    >
                        <span className={`create-collection-icon ${showCreateCollectionLine ? "active" : ""}`}>
                            <PlusIcon />
                        </span>
                    </button>
                )}
            </div>

            <div
                ref={createCollectionSectionRef}
                className={`create-collection-section ${showCreateCollectionLine ? "expanded" : ""}`}
            >
                <form className="create-collection-form" onSubmit={e => void handleCreateCollectionSubmit(e)}>
                    <input
                        ref={createCollectionInputRef}
                        type="text"
                        value={newCollectionName}
                        onChange={e => {
                            setNewCollectionName(e.target.value)
                        }}
                        placeholder="Collection name"
                        className="create-collection-input"
                    />

                    <button
                        type="submit"
                        className="create-collection-submit-button framer-button-primary"
                        disabled={!newCollectionName.trim()}
                        title="Create collection"
                    >
                        <CheckIcon />
                    </button>
                </form>
            </div>
        </>
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
