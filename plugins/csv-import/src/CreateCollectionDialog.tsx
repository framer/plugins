import { useEffect, useRef, useState } from "react"

interface CreateCollectionDialogProps {
    onCancel: () => void
    onSubmit: (name: string) => Promise<void>
}

export function CreateCollectionDialog({ onCancel, onSubmit }: CreateCollectionDialogProps) {
    const [name, setName] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        const trimmedName = name.trim()
        if (trimmedName) {
            await onSubmit(trimmedName)
        }
    }

    return (
        <div className="dialog-overlay">
            <form className="dialog" onSubmit={e => void handleSubmit(e)}>
                <div className="dialog-content">
                    <h3>Create Collection</h3>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={e => {
                            setName(e.target.value)
                        }}
                        placeholder="Collection name"
                        className="dialog-input"
                    />
                </div>
                <div className="dialog-actions">
                    <button type="button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="framer-button-primary" disabled={!name.trim()}>
                        Create
                    </button>
                </div>
            </form>
        </div>
    )
}
