import {
    framer,
    type ManagedCollectionField,
    type ManagedCollectionFieldInput,
    type ManagedCollection,
} from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import {
    type DataSource,
    getDataSourceFieldsInfo,
    mergeFieldsInfoWithExistingFields,
    syncCollection,
    fieldsInfoToCollectionFields,
} from "./data"
import { getPossibleSlugFieldIds, type FieldId, type FieldInfo } from "./api"
import classNames from "classnames"

type FieldType = ManagedCollectionField["type"]

const labelByFieldTypeOption: Record<FieldType, string> = {
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
    ignored: boolean
    onToggleIgnored: (fieldId: string) => void
    onNameChange: (fieldId: string, name: string) => void
    onFieldTypeChange: (fieldId: string, type: FieldType) => void
}

function FieldMappingRow({
    fieldInfo,
    ignored,
    onToggleIgnored,
    onNameChange,
    onFieldTypeChange,
}: FieldMappingRowProps) {
    const { id, name, originalName, type, allowedTypes } = fieldInfo
    const isUnsupported = !Array.isArray(allowedTypes) || allowedTypes.length === 0
    const disabled = isUnsupported || ignored

    return (
        <>
            <button
                type="button"
                className={classNames("source-field", isUnsupported && "unsupported")}
                aria-disabled={disabled}
                onClick={() => onToggleIgnored(id)}
                tabIndex={0}
            >
                <input type="checkbox" checked={!disabled} tabIndex={-1} readOnly />
                <span>{originalName ?? id}</span>
            </button>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="8"
                height="8"
                fill="none"
                style={{ opacity: disabled ? 0.5 : 1 }}
            >
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
                disabled={disabled || isUnsupported}
                placeholder={originalName ?? id}
                value={isUnsupported ? "Unsupported" : name}
                onChange={event => onNameChange(id, event.target.value)}
                onKeyDown={event => {
                    if (event.key === "Enter") {
                        event.preventDefault()
                    }
                }}
                className={classNames("field-input", isUnsupported && "unsupported")}
            />
            {!isUnsupported &&
                (Array.isArray(allowedTypes) && allowedTypes.length > 1 ? (
                    <select
                        className="field-type"
                        disabled={disabled}
                        value={type ?? ""}
                        onChange={event => onFieldTypeChange(id, event.target.value as FieldType)}
                    >
                        {allowedTypes.map(allowedType => (
                            <option key={allowedType} value={allowedType}>
                                {labelByFieldTypeOption[allowedType]}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className={classNames("single-field-type", disabled && "disabled")}>
                        {allowedTypes[0] ? labelByFieldTypeOption[allowedTypes[0]] : ""}
                    </div>
                ))}
        </>
    )
}

const initialManagedCollectionFields: ManagedCollectionFieldInput[] = []

interface FieldMappingProps {
    collection: ManagedCollection
    dataSource: DataSource
    initialSlugFieldId: string | null
    previousLastSynced: string | null
    previousIgnoredFieldIds: string | null
}

export function FieldMapping({
    collection,
    dataSource,
    initialSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
}: FieldMappingProps) {
    const [status, setStatus] = useState<"mapping-fields" | "loading-fields" | "syncing-collection">(
        initialSlugFieldId ? "loading-fields" : "mapping-fields"
    )
    const isSyncing = status === "syncing-collection"
    const isLoadingFields = status === "loading-fields"

    const initialFieldsInfo = useMemo(() => getDataSourceFieldsInfo(dataSource.database), [dataSource.database])
    const possibleSlugFieldIds = useMemo(() => getPossibleSlugFieldIds(dataSource.database), [dataSource.database])

    const [selectedSlugFieldId, setSelectedSlugFieldId] = useState<FieldId | null>(
        initialSlugFieldId ?? possibleSlugFieldIds[0] ?? null
    )

    const [fieldsInfo, setFieldsInfo] = useState(initialFieldsInfo)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(
        previousIgnoredFieldIds ? new Set(JSON.parse(previousIgnoredFieldIds)) : new Set()
    )

    const dataSourceName = dataSource.name

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(collectionFields => {
                if (abortController.signal.aborted) return

                setFieldsInfo(mergeFieldsInfoWithExistingFields(initialFieldsInfo, collectionFields))
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
        setFieldsInfo(prevFieldsInfo => {
            const updatedFieldInfo = prevFieldsInfo.map(fieldInfo => {
                if (fieldInfo.id !== fieldId) return fieldInfo
                return { ...fieldInfo, name }
            })
            return updatedFieldInfo
        })
    }

    const changeFieldType = (fieldId: string, type: FieldType) => {
        setFieldsInfo(prevFieldsInfo => {
            const updatedFieldInfo = prevFieldsInfo.map(fieldInfo => {
                if (fieldInfo.id !== fieldId) return fieldInfo
                if (!fieldInfo.allowedTypes.includes(type)) return fieldInfo
                return { ...fieldInfo, type }
            })
            return updatedFieldInfo
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

            const fields = await fieldsInfoToCollectionFields(fieldsInfo)
            const fieldsToSync = fields.filter(field => !ignoredFieldIds.has(field.id))
            const slugField = fields.find(field => field.id === selectedSlugFieldId)

            await syncCollection(collection, dataSource, fieldsToSync, slugField, ignoredFieldIds, previousLastSynced)
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
                                ignored={ignoredFieldIds.has(fieldInfo.id)}
                                onToggleIgnored={toggleFieldIgnoredState}
                                onNameChange={changeFieldName}
                                onFieldTypeChange={changeFieldType}
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
