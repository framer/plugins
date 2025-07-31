import type { Field, ManagedCollection, ManagedCollectionFieldInput } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { memo, useEffect, useMemo, useState } from "react"
import type { DataSource } from "./data"
import { mergeFieldsWithExistingFields, syncCollection, syncMethods } from "./data"
import type { PossibleField } from "./fields"
import { ALLOWED_FILE_TYPES, isCollectionReference } from "./utils"

function ChevronIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16">
            <title>Chevron</title>
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

const fieldTypeOptions: { type: Field["type"]; label: string }[] = [
    { type: "string", label: "Plain Text" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "date", label: "Date" },
    { type: "link", label: "Link" },
    { type: "image", label: "Image" },
    { type: "color", label: "Color" },
    { type: "boolean", label: "Toggle" },
    { type: "number", label: "Number" },
    { type: "enum", label: "Option" },
    { type: "file", label: "File" },
    { type: "array", label: "Gallery" },
]

interface FieldMappingRowProps {
    field: PossibleField
    originalFieldName: string | undefined
    isIgnored: boolean
    disabled: boolean
    unsupported?: boolean
    missingCollection?: boolean
    onToggleIgnored?: (fieldId: string) => void
    onNameChange?: (fieldId: string, name: string) => void
    onTypeChange?: (fieldId: string, type: string) => void
}

interface SelectOption {
    id: string
    label: string
}

const FieldMappingRow = memo(
    ({
        field,
        originalFieldName,
        isIgnored,
        disabled,
        unsupported = false,
        missingCollection,
        onToggleIgnored,
        onNameChange,
        onTypeChange,
    }: FieldMappingRowProps) => {
        let selectOptions: SelectOption[] = []
        if (!unsupported && !missingCollection) {
            if (isCollectionReference(field)) {
                selectOptions = field.supportedCollections.map(collection => ({
                    id: collection.id,
                    label: collection.name,
                }))
            } else if (Array.isArray(field.allowedTypes)) {
                selectOptions = field.allowedTypes.map(type => {
                    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1)
                    return {
                        id: type,
                        label: fieldTypeOptions.find(option => option.type === type)?.label ?? capitalizedType,
                    }
                })
            }
        }

        return (
            <>
                <button
                    type="button"
                    className="source-field"
                    aria-disabled={isIgnored}
                    onClick={disabled ? undefined : () => onToggleIgnored?.(field.id)}
                    tabIndex={0}
                    disabled={disabled || unsupported || missingCollection}
                >
                    <input type="checkbox" checked={!isIgnored} tabIndex={-1} readOnly disabled={disabled} />
                    <span>{originalFieldName ?? field.id}</span>
                </button>
                <ChevronIcon />
                {unsupported || missingCollection ? (
                    <div className="unsupported-field">{unsupported ? "Unsupported Field" : "Missing Collection"}</div>
                ) : (
                    <>
                        <select
                            disabled={isIgnored || disabled || selectOptions.length <= 1}
                            value={isCollectionReference(field) ? field.collectionId : field.type}
                            onChange={event => onTypeChange?.(field.id, event.target.value)}
                            className="field-type-select"
                        >
                            {selectOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            style={{
                                width: "100%",
                                opacity: isIgnored || disabled ? 0.5 : 1,
                            }}
                            disabled={isIgnored || disabled}
                            placeholder={originalFieldName ?? field.id}
                            value={field.name}
                            onChange={event => onNameChange?.(field.id, event.target.value)}
                            onKeyDown={event => {
                                if (event.key === "Enter") {
                                    event.preventDefault()
                                }
                            }}
                        />
                    </>
                )}
            </>
        )
    }
)

function isFieldMissingCollection(field: PossibleField): boolean {
    return isCollectionReference(field) && field.supportedCollections.length === 0
}

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

    const [selectedSlugField, setSelectedSlugField] = useState<ManagedCollectionFieldInput | null>(
        possibleSlugFields.find(field => field.id === initialSlugFieldId) ?? possibleSlugFields[0] ?? null
    )

    const [fields, setFields] = useState(initialManagedCollectionFields)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(initialFieldIds)

    // Create a map of field IDs to names for efficient lookup
    const originalFieldNameMap = useMemo(
        () => new Map(dataSource.fields.map(field => [field.id, field.name])),
        [dataSource.fields]
    )

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

                if (isCollectionReference(field)) {
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
                    case "string":
                        return { ...field, type: "string" } as PossibleField
                    case "formattedText":
                        return { ...field, type: "formattedText" } as PossibleField
                    case "number":
                        return { ...field, type: "number" } as PossibleField
                    case "boolean":
                        return { ...field, type: "boolean" } as PossibleField
                    case "color":
                        return { ...field, type: "color" } as PossibleField
                    case "date":
                        return { ...field, type: "date" } as PossibleField
                    case "enum":
                        return { ...field, type: "enum" } as PossibleField
                    case "array":
                        return {
                            ...field,
                            type: "array",
                            fields: [{ id: `${field.id}-image`, type: "image", name: "Image" }],
                        } as PossibleField
                    default:
                        return field
                }
            })
            return updatedFields
        })
    }

    const toggleFieldIgnoredState = (fieldId: string) => {
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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedSlugField) {
            // This can't happen because the form will not submit if no slug field is selected
            // but TypeScript can't infer that.
            console.error("There is no slug field selected. Sync will not be performed")
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        const task = async () => {
            try {
                setStatus("syncing-collection")

                const fieldsToSync = fields
                    .filter(field => !ignoredFieldIds.has(field.id))
                    .map(field => {
                        const originalFieldName = originalFieldNameMap.get(field.id)
                        return {
                            ...field,
                            name: (field.name.trim() || originalFieldName) ?? field.id,
                        }
                    })
                    .filter(field => field.type !== "unsupported")
                    .filter(
                        field =>
                            (field.type !== "collectionReference" && field.type !== "multiCollectionReference") ||
                            field.collectionId !== ""
                    )

                await collection.setFields(fieldsToSync)
                await syncCollection(collection, dataSource, fieldsToSync, selectedSlugField.id)
                framer.closePlugin("Synchronization successful", {
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

        void task()
    }

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

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
                <span>Slug Field</span>
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
                    disabled={!isAllowedToManage}
                    style={{ opacity: isAllowedToManage ? 1 : 0.5 }}
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
                <span>Type</span>
                <span>Name</span>
                {fields
                    .filter(field => field.type !== "unsupported" && !isFieldMissingCollection(field))
                    .map(field => (
                        <FieldMappingRow
                            key={`field-${field.id}`}
                            field={field}
                            originalFieldName={originalFieldNameMap.get(field.id)}
                            isIgnored={ignoredFieldIds.has(field.id)}
                            disabled={!isAllowedToManage}
                            onToggleIgnored={toggleFieldIgnoredState}
                            onNameChange={changeFieldName}
                            onTypeChange={changeFieldType}
                        />
                    ))}
                {fields.filter(isFieldMissingCollection).map(field => (
                    <FieldMappingRow
                        key={`field-${field.id}`}
                        field={field}
                        missingCollection
                        originalFieldName={originalFieldNameMap.get(field.id)}
                        isIgnored={true}
                        disabled={!isAllowedToManage}
                    />
                ))}
                {fields
                    .filter(field => field.type === "unsupported")
                    .map(field => (
                        <FieldMappingRow
                            key={`field-${field.id}`}
                            field={field}
                            unsupported
                            originalFieldName={originalFieldNameMap.get(field.id)}
                            isIgnored={true}
                            disabled={!isAllowedToManage}
                        />
                    ))}
            </div>

            <footer>
                <hr className="sticky-top" />
                <button
                    type="submit"
                    disabled={isSyncing || !isAllowedToManage}
                    tabIndex={0}
                    title={isAllowedToManage ? undefined : "Insufficient permissions"}
                >
                    {isSyncing ? <div className="framer-spinner" /> : <span>Import {dataSource.tableName}</span>}
                </button>
            </footer>
        </form>
    )
}
