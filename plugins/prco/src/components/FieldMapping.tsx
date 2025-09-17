import { framer, type ManagedCollection, useIsAllowedTo } from "framer-plugin"
import { type FormEventHandler, useCallback, useEffect, useMemo, useState } from "react"
import { mergeFieldsWithExistingFields, syncCollection, syncMethods } from "../data"
import { type PrcoDataSource, type PrcoField, removePrcoKeys } from "../dataSources"
import { isCollectionReference, isMissingReferenceField } from "../utils"
import { ChevronIcon } from "./ChevronIcon"
import { Loading } from "./Loading"

interface FieldMappingRowProps {
    field: PrcoField
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
    const isDisabled = disabled || isMissingReference

    return (
        <>
            <button
                type="button"
                className={`source-field ${isMissingReference ? "missing-reference" : ""}`}
                aria-disabled={isDisabled}
                onClick={() => {
                    onToggleDisabled(field.id)
                }}
                tabIndex={0}
            >
                <input type="checkbox" checked={!isDisabled} tabIndex={-1} readOnly />
                <span>{originalFieldName ?? field.id}</span>
            </button>
            <ChevronIcon />
            {isCollectionReference(field) ? (
                <select
                    className="target-field"
                    disabled={isDisabled}
                    value={field.collectionId}
                    onChange={event => {
                        onCollectionChange(field.id, event.target.value || (originalFieldName ?? ""))
                    }}
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
            ) : (
                <input
                    type="text"
                    className="target-field"
                    disabled={isDisabled}
                    placeholder={originalFieldName}
                    value={field.name !== originalFieldName ? field.name : ""}
                    onChange={event => {
                        onNameChange(field.id, event.target.value || (originalFieldName ?? ""))
                    }}
                />
            )}
        </>
    )
}

const emptyArray: PrcoField[] = []

interface FieldMappingProps {
    pressRoomId: string
    collection: ManagedCollection
    dataSource: PrcoDataSource
    initialSlugFieldId: string | null
}

export function FieldMapping({ pressRoomId, collection, dataSource, initialSlugFieldId }: FieldMappingProps) {
    const [status, setStatus] = useState<"mapping-fields" | "loading-fields" | "syncing-collection">(
        initialSlugFieldId ? "loading-fields" : "mapping-fields"
    )
    const isSyncing = status === "syncing-collection"
    const isLoadingFields = status === "loading-fields"

    const possibleSlugFields = useMemo(
        () => dataSource.fields.filter(field => field.type === "string" && field.canBeUsedAsSlug),
        [dataSource]
    )

    const [selectedSlugField, setSelectedSlugField] = useState<PrcoField | null>(
        possibleSlugFields.find(field => field.id === initialSlugFieldId) ?? possibleSlugFields[0] ?? null
    )

    const [fields, setFields] = useState<PrcoField[]>(emptyArray)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(() => {
        const initialFieldIds = new Set()

        for (const field of dataSource.fields) {
            if (!isMissingReferenceField(field)) continue

            initialFieldIds.add(field.id)
        }

        return initialFieldIds
    })

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(collectionFields => {
                if (abortController.signal.aborted) return

                setStatus("mapping-fields")
                setFields(mergeFieldsWithExistingFields(dataSource.fields, collectionFields))

                const existingFieldIds = new Set(collectionFields.map(field => field.id))

                if (initialSlugFieldId) {
                    const ignoredIds = new Set<string>()
                    for (const sourceField of dataSource.fields) {
                        if (existingFieldIds.has(sourceField.id)) continue
                        ignoredIds.add(sourceField.id)
                    }
                    setIgnoredFieldIds(ignoredIds)
                }
            })
            .catch((error: unknown) => {
                if (!abortController.signal.aborted) {
                    console.error("Failed to fetch collection fields:", error)
                    framer.notify("Failed to load collection fields", { variant: "error" })
                }
            })

        return () => {
            abortController.abort()
        }
    }, [initialSlugFieldId, dataSource, collection])

    const changeFieldName = useCallback((fieldId: string, name: string) => {
        setFields(prevFields =>
            prevFields.map(field => {
                if (field.id !== fieldId) return field
                return { ...field, name }
            })
        )
    }, [])

    const changeCollectionId = useCallback((fieldId: string, collectionId: string) => {
        setFields(prevFields =>
            prevFields.map(field => {
                if (field.id !== fieldId || !isCollectionReference(field)) return field
                return { ...field, collectionId }
            })
        )
    }, [])

    const toggleFieldDisabledState = useCallback((fieldId: string) => {
        setIgnoredFieldIds(previousIgnoredFieldIds => {
            const updatedIgnoredFieldIds = new Set(previousIgnoredFieldIds)

            if (updatedIgnoredFieldIds.has(fieldId)) {
                updatedIgnoredFieldIds.delete(fieldId)
            } else {
                updatedIgnoredFieldIds.add(fieldId)
            }

            return updatedIgnoredFieldIds
        })
    }, [])

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const handleSubmit: FormEventHandler<HTMLFormElement> = event => {
        event.preventDefault()

        if (!selectedSlugField) {
            // This can't happen because the form will not submit if no slug field is selected
            // but TypeScript can't infer that.
            console.error("There is no slug field selected. Sync will not be performed")
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        setStatus("syncing-collection")

        const fieldsToSync: PrcoField[] = []

        for (const field of fields) {
            if (ignoredFieldIds.has(field.id) || isMissingReferenceField(field)) continue
            fieldsToSync.push({
                ...field,
                name: field.name.trim() || field.id,
            })
        }
        collection
            .setFields(removePrcoKeys(fieldsToSync))
            .then(() => {
                syncCollection(pressRoomId, collection, dataSource, fieldsToSync, selectedSlugField)
                    .then(() => {
                        void framer.closePlugin("Synchronization successful", { variant: "success" })
                    })
                    .catch((error: unknown) => {
                        console.error(error)
                        framer.notify(
                            `Failed to sync collection “${dataSource.id}”. Check the logs for more details.`,
                            {
                                variant: "error",
                            }
                        )
                        setStatus("mapping-fields")
                    })
            })
            .catch((error: unknown) => {
                console.error(error)
                framer.notify(`Failed to set fields. Check the logs for more details.`, {
                    variant: "error",
                })
                setStatus("mapping-fields")
            })
    }

    if (isLoadingFields) {
        return <Loading />
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
