import classNames from "classnames"
import { framer, type ManagedCollection, type ManagedCollectionField, useIsAllowedTo } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import {
    type FieldId,
    type FieldInfo,
    getDatabaseFieldsInfo,
    getPossibleSlugFieldIds,
    isMissingCollection,
} from "./api"
import {
    type DatabaseIdMap,
    type DataSource,
    fieldsInfoToCollectionFields,
    mergeFieldsInfoWithExistingFields,
    parseIgnoredFieldIds,
    syncCollection,
} from "./data"
import { assert, syncMethods } from "./utils"

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
    array: "Gallery",
}

interface FieldMappingRowProps {
    fieldInfo: FieldInfo
    ignored: boolean
    isAllowedToManage: boolean
    unsupported: boolean
    missingCollection: boolean
    onToggleIgnored: (fieldId: string) => void
    onNameChange: (fieldId: string, name: string) => void
    onFieldTypeChange: (fieldId: string, type: ManagedCollectionField["type"]) => void
}

function FieldMappingRow({
    fieldInfo,
    ignored,
    isAllowedToManage,
    unsupported,
    missingCollection,
    onToggleIgnored,
    onNameChange,
    onFieldTypeChange,
}: FieldMappingRowProps) {
    const { id, name, originalName, type, allowedTypes } = fieldInfo
    const isFieldUnavailable = unsupported || missingCollection
    const disabled = isFieldUnavailable || ignored || !isAllowedToManage

    return (
        <>
            <button
                type="button"
                className={classNames("source-field", isFieldUnavailable && "unsupported")}
                aria-disabled={disabled}
                onClick={() => {
                    onToggleIgnored(id)
                }}
                tabIndex={0}
            >
                <input type="checkbox" checked={!disabled} tabIndex={-1} readOnly />
                <span>{originalName}</span>
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
            {isFieldUnavailable ? (
                <div className="unsupported-field">{unsupported ? "Unsupported Field" : "Missing Collection"}</div>
            ) : (
                <>
                    <select
                        className="field-type"
                        disabled={disabled || allowedTypes.length <= 1}
                        value={type ?? ""}
                        onChange={event => {
                            const value = allowedTypes.find(type => type === event.target.value)
                            assert(value, "Invalid field type")
                            onFieldTypeChange(id, value)
                        }}
                    >
                        {allowedTypes.map(allowedType => (
                            <option key={allowedType} value={allowedType}>
                                {labelByFieldTypeOption[allowedType]}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        disabled={disabled}
                        placeholder={originalName}
                        value={name}
                        onChange={event => {
                            onNameChange(id, event.target.value)
                        }}
                        onKeyDown={event => {
                            if (event.key === "Enter") {
                                event.preventDefault()
                            }
                        }}
                        className="field-input"
                    />
                </>
            )}
        </>
    )
}

interface FieldMappingProps {
    collection: ManagedCollection
    dataSource: DataSource
    initialSlugFieldId: string | null
    previousLastSynced: string | null
    previousIgnoredFieldIds: string | null
    databaseIdMap: DatabaseIdMap
}

export function FieldMapping({
    collection,
    dataSource,
    initialSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
    databaseIdMap,
}: FieldMappingProps) {
    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const [status, setStatus] = useState<"mapping-fields" | "loading-fields" | "syncing-collection">(
        initialSlugFieldId ? "loading-fields" : "mapping-fields"
    )
    const isSyncing = status === "syncing-collection"
    const isLoadingFields = status === "loading-fields"

    const dataSourceName = dataSource.name
    const database = dataSource.database

    const initialFieldsInfo = useMemo(() => getDatabaseFieldsInfo(database, databaseIdMap), [database, databaseIdMap])
    const possibleSlugFieldIds = useMemo(() => getPossibleSlugFieldIds(database), [database])

    const [selectedSlugFieldId, setSelectedSlugFieldId] = useState<FieldId | null>(
        initialSlugFieldId ?? possibleSlugFieldIds[0] ?? null
    )

    const [fieldsInfo, setFieldsInfo] = useState(initialFieldsInfo)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(parseIgnoredFieldIds(previousIgnoredFieldIds))

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(collectionFields => {
                if (abortController.signal.aborted) return

                setFieldsInfo(mergeFieldsInfoWithExistingFields(initialFieldsInfo, collectionFields))
                setStatus("mapping-fields")
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted) return

                console.error("Failed to fetch collection fields:", error)
                framer.notify("Failed to load collection fields", { variant: "error" })
            })

        return () => {
            abortController.abort()
        }
    }, [initialSlugFieldId, dataSource, collection, initialFieldsInfo])

    const changeFieldName = (fieldId: string, name: string) => {
        setFieldsInfo(prevFieldsInfo => {
            const updatedFieldInfo = prevFieldsInfo.map(fieldInfo => {
                if (fieldInfo.id !== fieldId) return fieldInfo
                return { ...fieldInfo, name }
            })
            return updatedFieldInfo
        })
    }

    const changeFieldType = (fieldId: string, type: ManagedCollectionField["type"]) => {
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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedSlugFieldId) {
            // This can't happen because the form will not submit if no slug field is selected
            // but TypeScript can't infer that.
            console.error("There is no slug field selected. Sync will not be performed")
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        const task = async () => {
            try {
                setStatus("syncing-collection")

                const fields = fieldsInfoToCollectionFields(fieldsInfo, databaseIdMap)
                const fieldsToSync = fields.filter(field => !ignoredFieldIds.has(field.id))
                const slugField = fields.find(field => field.id === selectedSlugFieldId)

                if (!slugField) {
                    framer.notify("Selected slug field not found. Sync will not be performed.", { variant: "error" })
                    return
                }

                await collection.setFields(fieldsToSync)
                await syncCollection(
                    collection,
                    dataSource,
                    fieldsToSync,
                    slugField,
                    ignoredFieldIds,
                    previousLastSynced
                )
                void framer.closePlugin("Synchronization successful", { variant: "success" })
            } catch (error) {
                console.error(error)
                framer.notify(`Failed to sync collection “${dataSource.id}”. Check the logs for more details.`, {
                    variant: "error",
                })
            } finally {
                setStatus("mapping-fields")
            }
        }

        void task()
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
                    <span>Slug Field</span>
                    <select
                        required
                        name="slugField"
                        className="field-input"
                        value={selectedSlugFieldId ?? ""}
                        disabled={!isAllowedToManage}
                        onChange={event => {
                            setSelectedSlugFieldId(
                                possibleSlugFieldIds.includes(event.target.value) ? event.target.value : null
                            )
                        }}
                    >
                        {possibleSlugFieldIds.map(possibleSlugFieldId => (
                            <option key={`slug-field-${possibleSlugFieldId}`} value={possibleSlugFieldId}>
                                {fieldsInfo.find(field => field.id === possibleSlugFieldId)?.name ??
                                    possibleSlugFieldId}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="fields">
                    <span className="fields-column">Notion Property</span>
                    <span>Type</span>
                    <span>Name</span>
                    {fieldsInfo.map(fieldInfo => (
                        <FieldMappingRow
                            key={`field-${fieldInfo.id}`}
                            fieldInfo={fieldInfo}
                            ignored={ignoredFieldIds.has(fieldInfo.id)}
                            isAllowedToManage={isAllowedToManage}
                            unsupported={!Array.isArray(fieldInfo.allowedTypes) || fieldInfo.allowedTypes.length === 0}
                            missingCollection={isMissingCollection(fieldInfo, databaseIdMap)}
                            onToggleIgnored={toggleFieldIgnoredState}
                            onNameChange={changeFieldName}
                            onFieldTypeChange={changeFieldType}
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
                            <span>Import from {dataSourceName.trim() ? dataSourceName : "Untitled"}</span>
                        )}
                    </button>
                </footer>
            </form>
        </main>
    )
}
