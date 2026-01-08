import { useCallback, useRef, useState } from "react"
import type { ImportItem } from "../utils/prepareImportPayload"

interface ManageConflictsProps {
    records: ImportItem[]
    onAllConflictsResolved: (items: ImportItem[]) => void
}

export function ManageConflicts({ records, onAllConflictsResolved }: ManageConflictsProps) {
    const [remainingRecords, setRemainingRecords] = useState(() =>
        records.filter(record => record.action === "conflict")
    )
    const currentRecord = remainingRecords[0]

    const [applyToAll, setApplyToAll] = useState(false)

    const fixedRecords = useRef<ImportItem[]>(records)

    const moveToNextRecord = useCallback(() => {
        setRemainingRecords(prev => {
            if (prev.length === 0) {
                onAllConflictsResolved(fixedRecords.current)
                return prev
            }
            const [, ...rest] = prev
            return rest
        })
    }, [onAllConflictsResolved])

    const setAction = useCallback(
        (record: ImportItem, action: "onConflictUpdate" | "onConflictSkip") => {
            if (!currentRecord) return

            fixedRecords.current = fixedRecords.current.map(existingRecord => {
                if (existingRecord.slug === record.slug) {
                    return { ...existingRecord, action }
                }
                return existingRecord
            })
        },
        [currentRecord]
    )

    const applyAction = useCallback(
        (action: "onConflictUpdate" | "onConflictSkip") => {
            if (!currentRecord) return

            if (!applyToAll) {
                setAction(currentRecord, action)
                moveToNextRecord()
                return
            }

            setAction(currentRecord, action)
            setRemainingRecords(prev => {
                for (const record of prev) {
                    setAction(record, action)
                }
                onAllConflictsResolved(fixedRecords.current)
                return []
            })
        },
        [currentRecord, applyToAll, setAction, moveToNextRecord, onAllConflictsResolved]
    )

    if (!currentRecord) return null

    return (
        <form
            onSubmit={event => {
                event.preventDefault()
                applyAction("onConflictUpdate")
            }}
            className="manage-conflicts"
        >
            <div className="content">
                <div className="message">
                    <span style={{ color: "var(--framer-color-text)", fontWeight: 600 }}>
                        Slug: "{currentRecord.slug}"
                    </span>
                    <p>An item with this slug value already exists.</p>
                </div>

                <label className="apply-to-all">
                    <input
                        type="checkbox"
                        id="apply-to-all"
                        checked={applyToAll}
                        onChange={event => {
                            setApplyToAll(event.currentTarget.checked)
                        }}
                    />
                    All ({remainingRecords.length} items)
                </label>
            </div>

            <hr />

            <div className="actions">
                <button
                    type="button"
                    onClick={() => {
                        applyAction("onConflictSkip")
                    }}
                >
                    Skip
                </button>
                <button type="submit" className="framer-button-primary">
                    Update
                </button>
            </div>
        </form>
    )
}
