import {
    framer,
    type ManagedCollectionField,
    type ManagedCollectionFieldInput,
    type ManagedCollection,
} from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import { type DataSource, getDataSourceFieldsInfo, mergeFieldsWithExistingFields, syncCollection } from "./data"
import { getPossibleSlugFieldIds, type FieldId, type FieldInfo } from "./api"

const labelByFieldTypeOption: Record<ManagedCollectionField["type"], string> = {
    boolean: "Toggle",
    date: "Date",
    number: "Number",
    formattedText: "Formatted Text",
    color: "Color",
    enum: "Option",
    file: "File",
    image: "Image",
    link: "Link",
    string: "Plain Text",
    collectionReference: "Reference",
    multiCollectionReference: "Multi-Reference",
}

interface FieldMappingRowProps {
    fieldInfo: FieldInfo
    onToggleDisabled: (fieldId: string) => void
    onNameChange: (fieldId: string, name: string) => void
}

function FieldMappingRow({ fieldInfo, onToggleDisabled, onNameChange }: FieldMappingRowProps) {
    const { id, name, originalName, type, allowedTypes } = fieldInfo
    const isUnsupported = !Array.isArray(allowedTypes) || allowedTypes.length === 0
    const disabled = isUnsupported || fieldInfo.disabled

    return (
        <>
            <button
                type="button"
                className={"source-field" + (disabled ? " unsupported" : "")}
                aria-disabled={disabled}
                onClick={() => onToggleDisabled(id)}
                tabIndex={0}
            >
                <input type="checkbox" checked={!disabled} tabIndex={-1} readOnly />
                <span>{originalName ?? id}</span>
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
            <input
                type="text"
                style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}
                disabled={disabled || isUnsupported}
                placeholder={originalName ?? id}
                value={isUnsupported ? "Unsupported" : name}
                onChange={event => onNameChange(id, event.target.value)}
                onKeyDown={event => {
                    if (event.key === "Enter") {
                        event.preventDefault()
                    }
                }}
                className={"field-input" + (isUnsupported ? " unsupported" : "")}
            />
            {!isUnsupported &&
                (Array.isArray(allowedTypes) && allowedTypes.length > 1 ? (
                    <select className="field-type" disabled={disabled} value={type ?? ""}>
                        {allowedTypes.map(allowedType => (
                            <option key={allowedType} value={allowedType}>
                                {labelByFieldTypeOption[allowedType]}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="single-field-type">{labelByFieldTypeOption[allowedTypes[0]]}</div>
                ))}
        </>
    )
}

const initialManagedCollectionFields: ManagedCollectionFieldInput[] = []
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

    const fieldsInfo = useMemo(() => getDataSourceFieldsInfo(dataSource.database), [dataSource.database])
    const possibleSlugFieldIds = useMemo(() => getPossibleSlugFieldIds(dataSource.database), [dataSource.database])

    const [selectedSlugFieldId, setSelectedSlugFieldId]: FieldId | null = useState(
        initialSlugFieldId ?? possibleSlugFieldIds[0] ?? null
    )

    const [fields, setFields] = useState(initialManagedCollectionFields)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(initialFieldIds)

    const dataSourceName = dataSource.name

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

        if (!selectedSlugFieldId) {
            // This can't happen because the form will not submit if no slug field is selected
            // but TypeScript can't infer that.
            console.error("There is no slug field selected. Sync will not be performed")
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        try {
            setStatus("syncing-collection")

            const fieldsToSync = fields.filter(field => !ignoredFieldIds.has(field.id))

            await syncCollection(collection, dataSource, fieldsToSync, selectedSlugFieldId)
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
            <hr className="sticky-divider" />
            <form onSubmit={handleSubmit}>
                <label className="slug-field" htmlFor="slugField">
                    Slug Field
                    <select
                        required
                        name="slugField"
                        className="field-input"
                        value={selectedSlugFieldId ?? ""}
                        onChange={event => {
                            setSelectedSlugFieldId(
                                possibleSlugFieldIds.includes(event.target.value) ? event.target.value : null
                            )
                        }}
                    >
                        {possibleSlugFieldIds.map(possibleSlugFieldId => {
                            return (
                                <option key={`slug-field-${possibleSlugFieldId}`} value={possibleSlugFieldId}>
                                    {fieldsInfo.find(field => field.id === possibleSlugFieldId)?.name ??
                                        possibleSlugFieldId}
                                </option>
                            )
                        })}
                    </select>
                </label>

                <div className="fields">
                    <span className="fields-column">Notion Property</span>
                    <span>Field Name</span>
                    <span>Field Type</span>
                    {fieldsInfo.map(fieldInfo => {
                        return (
                            <FieldMappingRow
                                key={`field-${fieldInfo.id}`}
                                fieldInfo={fieldInfo}
                                onToggleDisabled={toggleFieldDisabledState}
                                onNameChange={changeFieldName}
                            />
                        )
                    })}
                </div>

                <footer>
                    <hr className="sticky-top" />
                    <button disabled={isSyncing} tabIndex={0}>
                        {isSyncing ? <div className="framer-spinner" /> : <span>Import from {dataSourceName}</span>}
                    </button>
                </footer>
            </form>
        </main>
    )
}
