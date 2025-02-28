import type { ManagedCollection, EditableManagedCollectionField, CollectionField } from "framer-plugin"
import type { DataSource, PossibleField } from "./data"

import { framer } from "framer-plugin"
import { useState, useEffect, memo } from "react"
import { mergeFieldsWithExistingFields, syncCollection } from "./data"
import { ALLOWED_FILE_TYPES, isCollectionReference } from "./utils"

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

const fieldTypeOptions: { type: CollectionField["type"]; label: string }[] = [
    { type: "boolean", label: "Boolean" },
    { type: "color", label: "Color" },
    { type: "number", label: "Number" },
    { type: "string", label: "String" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "image", label: "Image" },
    { type: "link", label: "Link" },
    { type: "date", label: "Date" },
    { type: "enum", label: "Option" },
    { type: "file", label: "File" },
]

interface FieldMappingRowProps {
    field: PossibleField
    originalFieldName: string | undefined
    disabled: boolean
    onToggleDisabled?: (fieldId: string) => void
    onNameChange?: (fieldId: string, name: string) => void
    onTypeChange?: (fieldId: string, type: string) => void
}

const FieldMappingRow = memo(
    ({ field, originalFieldName, disabled, onToggleDisabled, onNameChange, onTypeChange }: FieldMappingRowProps) => {
        return (
            <>
                <button
                    type="button"
                    className="source-field"
                    aria-disabled={disabled}
                    onClick={() => onToggleDisabled?.(field.id)}
                    tabIndex={0}
                >
                    <input type="checkbox" checked={!disabled} tabIndex={-1} readOnly />
                    <span>{originalFieldName ?? field.id}</span>
                </button>
                <ChevronIcon />
                <input
                    type="text"
                    style={{
                        width: "100%",
                        opacity: disabled ? 0.5 : 1,
                    }}
                    disabled={disabled}
                    placeholder={field.id}
                    value={field.name}
                    onChange={event => onNameChange?.(field.id, event.target.value)}
                    onKeyDown={event => {
                        if (event.key === "Enter") {
                            event.preventDefault()
                        }
                    }}
                />
                <ChevronIcon />
                <select
                    style={{
                        width: "100%",
                        opacity: disabled ? 0.5 : 1,
                    }}
                    disabled={disabled}
                    value={isCollectionReference(field) ? field.collectionId : field.type}
                    onChange={event => onTypeChange?.(field.id, event.target.value)}
                >
                    {isCollectionReference(field) && (
                        <>
                            {field.supportedCollections.length === 0 && (
                                <option value="unsupported">Unsupported</option>
                            )}
                            {field.supportedCollections.map(collection => (
                                <option key={collection.id} value={collection.id}>
                                    {collection.name}
                                </option>
                            ))}
                        </>
                    )}
                    {!isCollectionReference(field) &&
                        field.allowedTypes?.map(type => (
                            <option key={type} value={type}>
                                {fieldTypeOptions.find(option => option.type === type)?.label}
                            </option>
                        ))}
                </select>
            </>
        )
    }
)

const initialManagedCollectionFields: PossibleField[] = []
const initialFieldIds: ReadonlySet<string> = new Set()

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

    const [selectedSlugField, setSelectedSlugField] = useState<EditableManagedCollectionField | null>(
        possibleSlugFields.find(field => field.id === initialSlugFieldId) ?? possibleSlugFields[0] ?? null
    )

    const [fields, setFields] = useState(initialManagedCollectionFields)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(initialFieldIds)

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(collectionFields => {
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

    const changeFieldType = (fieldId: string, type: string) => {
        setFields(prevFields => {
            const updatedFields = prevFields.map(field => {
                if (field.id !== fieldId) return field

                if (field.airtableType === "multipleRecordLinks") {
                    return {
                        ...field,
                        type: "multiCollectionReference",
                        collectionId: type,
                        supportedCollections: field.supportedCollections,
                    } as PossibleField
                }

                switch (type) {
                    case "link":
                        return { ...field, type: "link" } as PossibleField
                    case "file":
                        return {
                            ...field,
                            type: "file",
                            allowedFileTypes: ALLOWED_FILE_TYPES,
                        } as PossibleField
                    case "image":
                        return { ...field, type: "image" } as PossibleField
                    default:
                        return field
                }
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

            await syncCollection(collection, dataSource, fieldsToSync, selectedSlugField.id)
            await framer.closePlugin("Synchronization successful", {
                variant: "success",
            })
        } catch (error) {
            console.error(error)
            framer.notify(`Failed to sync collection "${dataSource.tableName}". Check the logs for more details.`, {
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
        <form className="framer-hide-scrollbar mapping" onSubmit={handleSubmit}>
            <hr className="sticky-top" />
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
                <span className="column-span-2">Column</span>
                <span className="column-span-2">Field</span>
                <span>Type</span>
                {fields
                    .filter(
                        field =>
                            field.type !== "divider" &&
                            field.type !== "unsupported" &&
                            (!isCollectionReference(field) || field.supportedCollections.length > 0)
                    )
                    .map(field => (
                        <FieldMappingRow
                            key={`field-${field.id}`}
                            field={field}
                            originalFieldName={dataSource.fields.find(sourceField => sourceField.id === field.id)?.name}
                            disabled={ignoredFieldIds.has(field.id)}
                            onToggleDisabled={toggleFieldDisabledState}
                            onNameChange={changeFieldName}
                            onTypeChange={changeFieldType}
                        />
                    ))}
                {fields
                    .filter(
                        field =>
                            (isCollectionReference(field) && field.supportedCollections.length === 0) ||
                            field.type === "unsupported"
                    )
                    .map(field => (
                        <FieldMappingRow
                            key={`field-${field.id}`}
                            field={{
                                ...field,
                                name: isCollectionReference(field) ? "Missing Collection" : "Unsupported field",
                            }}
                            originalFieldName={dataSource.fields.find(sourceField => sourceField.id === field.id)?.name}
                            disabled={true}
                        />
                    ))}
            </div>

            <footer>
                <hr className="sticky-top" />
                <button disabled={isSyncing} tabIndex={0}>
                    {isSyncing ? (
                        <div className="framer-spinner" />
                    ) : (
                        <span>
                            Import <span style={{ textTransform: "capitalize" }}>{dataSource.tableName}</span>
                        </span>
                    )}
                </button>
            </footer>
        </form>
    )
}
