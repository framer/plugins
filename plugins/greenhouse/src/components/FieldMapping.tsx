import { framer, useIsAllowedTo, type ManagedCollection } from "framer-plugin"
import { useEffect, useState } from "react"
import { mergeFieldsWithExistingFields, syncCollection, syncMethods } from "../data"
import { isCollectionReference, isMissingReferenceField } from "../utils"
import { removeGreenhouseKeys, type GreenhouseDataSource, type GreenhouseField } from "../dataSources"

function ChevronIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16">
            <path
                d="M 3 11 L 6 8 L 3 5"
                fill="transparent"
                strokeWidth="1.5"
                stroke="#999"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

interface FieldMappingRowProps {
    field: GreenhouseField
    originalFieldName: string | undefined
    disabled: boolean
    onToggleDisabled: (fieldId: string) => void
    onNameChange: (fieldId: string, name: string) => void
    onCollectionChange: (fieldId: string, collectionId: string) => void
}

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
                aria-disabled={disabled || isMissingReference}
                onClick={() => onToggleDisabled(field.id)}
                tabIndex={0}
            >
                <input type="checkbox" checked={!disabled && !isMissingReference} tabIndex={-1} readOnly />
                <span>{originalFieldName ?? field.id}</span>
            </button>
            <ChevronIcon />
            {isCollectionReference(field) && (
                <>
                    <select
                        className="target-field"
                        disabled={disabled || isMissingReference}
                        value={field.collectionId}
                        onChange={event => onCollectionChange(field.id, event.target.value)}
                    >
                        {field.supportedCollections?.length === 0 && (
                            <option value="" disabled>
                                Missing Collection
                            </option>
                        )}
                        {field.supportedCollections?.map(collection => (
                            <option key={collection.id} value={collection.id}>
                                {collection.name}
                            </option>
                        ))}
                    </select>
                </>
            )}
            {!isCollectionReference(field) && (
                <input
                    type="text"
                    className="target-field"
                    disabled={disabled}
                    placeholder={originalFieldName}
                    value={field.name !== originalFieldName ? field.name : ""}
                    onChange={event => onNameChange(field.id, event.target.value || (originalFieldName ?? ""))}
                />
            )}
        </>
    )
}

const initialManagedCollectionFields: GreenhouseField[] = []

interface FieldMappingProps {
    boardToken: string
    collection: ManagedCollection
    dataSource: GreenhouseDataSource
    initialSlugFieldId: string | null
}

export function FieldMapping({ boardToken, collection, dataSource, initialSlugFieldId }: FieldMappingProps) {
    const [status, setStatus] = useState<"mapping-fields" | "loading-fields" | "syncing-collection">(
        initialSlugFieldId ? "loading-fields" : "mapping-fields"
    )
    const isSyncing = status === "syncing-collection"
    const isLoadingFields = status === "loading-fields"

    const [possibleSlugFields] = useState(() =>
        dataSource.fields.filter(field => field.type === "string" && field.canBeUsedAsSlug)
    )

    const [selectedSlugField, setSelectedSlugField] = useState<GreenhouseField | null>(
        possibleSlugFields.find(field => field.id === initialSlugFieldId) ?? possibleSlugFields[0] ?? null
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

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(async collectionFields => {
                if (abortController.signal.aborted) return

                setFields(mergeFieldsWithExistingFields(dataSource.fields, collectionFields))

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
                if (!isCollectionReference(field)) return field
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

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

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

            const fieldsToSync = fields
                .filter(field => !ignoredFieldIds.has(field.id))
                .map(field => ({
                    ...field,
                    name: field.name.trim() || field.id,
                }))
                .filter(
                    field =>
                        (field.type !== "collectionReference" && field.type !== "multiCollectionReference") ||
                        field.collectionId !== ""
                )

            await collection.setFields(removeGreenhouseKeys(fieldsToSync))
            await syncCollection(boardToken, collection, dataSource, fieldsToSync, selectedSlugField)
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
        <main className="framer-hide-scrollbar mapping">
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
                </div>

                <footer>
                    <hr className="sticky-top" />
                    <button
                        disabled={isSyncing || !isAllowedToManage}
                        tabIndex={0}
                        title={!isAllowedToManage ? "Insufficient permissions" : undefined}
                    >
                        {isSyncing ? (
                            <div className="framer-spinner" />
                        ) : (
                            <span>
                                Import <span style={{ textTransform: "capitalize" }}>{dataSource.name}</span>
                            </span>
                        )}
                    </button>
                </footer>
            </form>
        </main>
    )
}
