import type { Collection } from "framer-plugin"
import { framer } from "framer-plugin"
import { useState } from "react"
import { useMiniRouter } from "../minirouter"

interface CreateCollectionProps {
    reason: "initialState" | "user"
    onCollectionCreated: (collection: Collection) => void
}

export function CreateCollection({ reason, onCollectionCreated }: CreateCollectionProps) {
    const [name, setName] = useState("")
    const { navigate } = useMiniRouter()

    const handleCreate = async () => {
        const trimmedName = name.trim()
        if (!trimmedName) return

        const newCollection = await framer.createCollection(trimmedName)
        await newCollection.setAsActive()
        onCollectionCreated(newCollection)
    }

    const handleCancel = () => {
        if (reason === "initialState") {
            framer.closePlugin(undefined, { silent: true })
        } else {
            void navigate({ uid: "home", opts: undefined })
        }
    }

    return (
        <form className="create-collection" onSubmit={() => void handleCreate()}>
            <input
                type="text"
                value={name}
                onChange={e => {
                    setName(e.target.value)
                }}
                placeholder="Collection name"
                autoFocus
            />

            <div className="flex1" />

            <div className="actions">
                <button
                    type="button"
                    onClick={() => {
                        handleCancel()
                    }}
                >
                    Cancel
                </button>

                <button type="submit" className="framer-button-primary" disabled={!name.trim()}>
                    Create
                </button>
            </div>
        </form>
    )
}
