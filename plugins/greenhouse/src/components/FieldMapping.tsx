import { type ManagedCollectionFieldInput, framer, type ManagedCollection } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { type DataSource, dataSourceOptions, mergeFieldsWithExistingFields, syncCollection } from "../data"
import { type ExtendedManagedCollectionFieldInput } from "../data"

interface FieldMappingRowProps {
    field: ExtendedManagedCollectionFieldInput
    originalFieldName: string | undefined
    disabled: boolean
    onToggleDisabled: (fieldId: string) => void
    onNameChange: (fieldId: string, name: string) => void
    onCollectionChange: (fieldId: string, collectionId: string) => void
}

const isMissingReferenceField = (field: ManagedCollectionFieldInput) =>
    (field.type === "multiCollectionReference" || field.type === "collectionReference") && !field.collectionId

function FieldMappingRow({
    field,
    originalFieldName,
    disabled,
    onToggleDisabled,
    onNameChange,
    onCollectionChange,
}: FieldMappingRowProps) {
    const isMissingReference = isMissingReferenceField(field)

    return (
        <>
            <button
                type="button"
                className="source-field"
                aria-disabled={disabled}
                onClick={() => onToggleDisabled(field.id)}
                tabIndex={0}
                style={isMissingReference ? { cursor: "not-allowed" } : {}}
            >
                <input type="checkbox" checked={!disabled} tabIndex={-1} readOnly />
                <span>{originalFieldName ?? field.id}</span>
            </button>
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none">
                <path
                    fill="transparent"
                    stroke="#999"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="m2.5 7 3-3-3-3"
                />
            </svg>
            {(field.type === "multiCollectionReference" || field.type === "collectionReference") &&
            (field.collectionsOptions?.length ?? 0) > 1 ? (
                <select
                    style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}
                    disabled={disabled}
                    value={field.collectionId}
                    onChange={e => onCollectionChange(field.id, e.target.value)}
                >
                    {field.collectionsOptions?.map(collection => (
                        <option key={collection.id} value={collection.id}>
                            {collection.name}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    type="text"
                    style={{
                        width: "100%",
                        opacity: disabled ? 0.5 : 1,
                        ...(isMissingReference ? { cursor: "not-allowed" } : {}),
                    }}
                    disabled={disabled}
                    placeholder={field.id}
                    value={isMissingReference ? "Missing Collection" : field.name}
                    onChange={event => onNameChange(field.id, event.target.value)}
                />
            )}
        </>
    )
}

const initialManagedCollectionFields: ManagedCollectionFieldInput[] = []

interface FieldMappingProps {
    collection: ManagedCollection
    dataSource: DataSource
    initialSlugFieldId: string | null
}

export function FieldMapping({ collection, dataSource, initialSlugFieldId }: FieldMappingProps) {
    const [status, setStatus] = useState<"mapping-fields" | "loading-fields" | "syncing-collection">(
        initialSlugFieldId ? "loading-fields" : "mapping-fields"
    )
    const isSyncing = status === "syncing-collection"
    const isLoadingFields = status === "loading-fields"

    const [possibleSlugFields] = useState(() => dataSource.fields.filter(field => field.type === "string"))

    const [selectedSlugField, setSelectedSlugField] = useState<ManagedCollectionFieldInput | null>(
        possibleSlugFields.find(field => field.id === initialSlugFieldId) ??
            dataSource.slugField ??
            possibleSlugFields[0] ??
            null
    )

    const [fields, setFields] = useState(initialManagedCollectionFields)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(() => {
        const initialFieldIds = new Set()

        for (const field of dataSource.fields) {
            if (isMissingReferenceField(field)) {
                initialFieldIds.add(field.id)
            }
        }

        return initialFieldIds
    })

    const dataSourceName = dataSourceOptions.find(option => option.id === dataSource.id)?.name ?? dataSource.id

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(collectionFields => {
                if (abortController.signal.aborted) return

                setFields(
                    mergeFieldsWithExistingFields(dataSource.fields, collectionFields as ManagedCollectionFieldInput[])
                )

                const existingFieldIds = new Set(collectionFields.map(field => field.id))
                const ignoredFields = dataSource.fields.filter(sourceField => !existingFieldIds.has(sourceField.id))

                if (initialSlugFieldId) {
                    setIgnoredFieldIds(new Set(ignoredFields.map(field => field.id)))
                }

                setStatus("mapping-fields")
            })
            .catch(error => {
                if (!abortController.signal.aborted) {
                    console.error("Failed to fetch collection fields:", error)
                    framer.notify("Failed to load collection fields", { variant: "error" })
                }
            })

        return () => {
            abortController.abort()
        }
    }, [initialSlugFieldId, dataSource, collection])

    const changeFieldName = (fieldId: string, name: string) => {
        setFields(prevFields => {
            const updatedFields = prevFields.map(field => {
                if (field.id !== fieldId) return field
                return { ...field, name }
            })
            return updatedFields
        })
    }

    const changeCollectionId = (fieldId: string, collectionId: string) => {
        setFields(prevFields => {
            const updatedFields = prevFields.map(field => {
                if (field.id !== fieldId) return field
                return { ...field, collectionId }
            })
            return updatedFields
        })
    }

    const toggleFieldDisabledState = (fieldId: string) => {
        setIgnoredFieldIds(previousIgnoredFieldIds => {
            const updatedIgnoredFieldIds = new Set(previousIgnoredFieldIds)

            if (updatedIgnoredFieldIds.has(fieldId)) {
                updatedIgnoredFieldIds.delete(fieldId)
            } else {
                updatedIgnoredFieldIds.add(fieldId)
            }

            return updatedIgnoredFieldIds
        })
    }

    const triggerRef = useRef<HTMLDivElement>(null)
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsScrolled(entry.isIntersecting)
            },
            {
                root: null,
                rootMargin: "0px",
                threshold: 0,
            }
        )

        if (triggerRef.current) {
            observer.observe(triggerRef.current)
        }

        return () => {
            observer.disconnect()
        }
    }, [fields])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedSlugField) {
            // This can't happen because the form will not submit if no slug field is selected
            // but TypeScript can't infer that.
            console.error("There is no slug field selected. Sync will not be performed")
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        try {
            setStatus("syncing-collection")

            const fieldsToSync = fields.filter(field => !ignoredFieldIds.has(field.id))

            await syncCollection(collection, dataSource, fieldsToSync, selectedSlugField)
            await framer.closePlugin("Synchronization successful", { variant: "success" })
        } catch (error) {
            console.error(error)
            framer.notify(`Failed to sync collection “${dataSource.id}”. Check the logs for more details.`, {
                variant: "error",
            })
        } finally {
            setStatus("mapping-fields")
        }
    }

    if (isLoadingFields) {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    return (
        <div className="framer-hide-scrollbar mapping">
            {/* <hr className="sticky-divider" /> */}
            <form onSubmit={handleSubmit}>
                <label className="slug-field" htmlFor="slugField">
                    Slug Field
                    <select
                        required
                        name="slugField"
                        className="field-input"
                        value={selectedSlugField ? selectedSlugField.id : ""}
                        onChange={event => {
                            const selectedFieldId = event.target.value
                            const selectedField = possibleSlugFields.find(field => field.id === selectedFieldId)
                            if (!selectedField) return
                            setSelectedSlugField(selectedField)
                        }}
                    >
                        {possibleSlugFields.map(possibleSlugField => {
                            return (
                                <option key={`slug-field-${possibleSlugField.id}`} value={possibleSlugField.id}>
                                    {possibleSlugField.name}
                                </option>
                            )
                        })}
                    </select>
                </label>

                <div className="fields">
                    <span className="fields-column">Column</span>
                    <span>Field</span>
                    {fields.map(field => (
                        <FieldMappingRow
                            key={`field-${field.id}`}
                            field={field}
                            originalFieldName={dataSource.fields.find(sourceField => sourceField.id === field.id)?.name}
                            disabled={ignoredFieldIds.has(field.id)}
                            onToggleDisabled={() => {
                                if (isMissingReferenceField(field)) return
                                toggleFieldDisabledState(field.id)
                            }}
                            onNameChange={changeFieldName}
                            onCollectionChange={changeCollectionId}
                        />
                    ))}
                    <div ref={triggerRef} style={{ position: "absolute", bottom: "-50px", left: 0, right: 0 }}></div>
                </div>

                <footer className={isScrolled ? "scrolled" : ""}>
                    <hr className="sticky-top" />
                    <button disabled={isSyncing} tabIndex={0}>
                        {isSyncing ? (
                            <div className="framer-spinner" />
                        ) : (
                            <span>
                                Import <span style={{ textTransform: "capitalize" }}>{dataSourceName}</span>
                            </span>
                        )}
                    </button>
                </footer>
            </form>
        </div>
    )
}
