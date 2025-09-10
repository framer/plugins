import classNames from "classnames"
import {
    framer,
    type ManagedCollection,
    type ManagedCollectionField,
    type MenuItem,
    useIsAllowedTo,
} from "framer-plugin"
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
    parseAltTextMappings,
    parseIgnoredFieldIds,
    syncCollection,
} from "./data"
import { syncMethods } from "./utils"

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
    fieldsInfo: FieldInfo[]
    ignoredFieldIds: Set<string>
    onToggleIgnored: (fieldId: string) => void
    onNameChange: (fieldId: string, name: string) => void
    onFieldTypeChange: (fieldId: string, type: ManagedCollectionField["type"]) => void
    onAltTextFieldChange?: (fieldId: string, altTextForImageFieldId: string | null) => void
}

function FieldMappingRow({
    fieldInfo,
    ignored,
    isAllowedToManage,
    unsupported,
    missingCollection,
    fieldsInfo,
    ignoredFieldIds,
    onToggleIgnored,
    onNameChange,
    onFieldTypeChange,
    onAltTextFieldChange,
}: FieldMappingRowProps) {
    const { id, name, originalName, type, allowedTypes } = fieldInfo
    const isFieldUnavailable = unsupported || missingCollection
    const disabled = isFieldUnavailable || ignored || !isAllowedToManage

    const fieldTypeButtonText = useMemo(() => {
        if (!type) return "Select type..."

        if (fieldInfo.altTextForImageFieldId) {
            const targetField = fieldsInfo.find(f => f.id === fieldInfo.altTextForImageFieldId)
            return `${targetField?.name ?? "Unknown"} Alt Text`
        }

        return labelByFieldTypeOption[type]
    }, [type, fieldInfo.altTextForImageFieldId, fieldsInfo])

    const handleFieldTypeClick = async (event: React.MouseEvent) => {
        if (disabled || allowedTypes.length <= 1) return

        const buttonElement = event.currentTarget as HTMLElement
        const buttonRect = buttonElement.getBoundingClientRect()

        const menuItems: MenuItem[] = allowedTypes.map(allowedType => ({
            label: labelByFieldTypeOption[allowedType],
            checked: type === allowedType && !fieldInfo.altTextForImageFieldId,
            onAction: () => {
                onFieldTypeChange(id, allowedType)
            },
        }))

        const isCurrentFieldTextBased = type && ["string", "formattedText"].includes(type)
        const imageFields = fieldsInfo.filter(
            field => field.id !== id && field.type === "image" && !ignoredFieldIds.has(field.id)
        )

        if (isCurrentFieldTextBased && imageFields.length > 0) {
            const altTextSubmenu = imageFields.map(imageField => ({
                label: imageField.name,
                checked: fieldInfo.altTextForImageFieldId === imageField.id,
                onAction: () => {
                    onAltTextFieldChange?.(id, imageField.id)
                },
            }))

            menuItems.push({
                label: "Alt Text...",
                submenu: altTextSubmenu,
            })
        }

        await framer.showContextMenu(menuItems, {
            location: {
                x: buttonRect.left,
                y: buttonRect.top - 4,
            },
            width: buttonRect.width + 8,
        })
    }

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
                    <button
                        type="button"
                        className="field-type-button"
                        disabled={disabled || allowedTypes.length <= 1}
                        onClick={event => {
                            void handleFieldTypeClick(event)
                        }}
                    >
                        <span className="field-type-button-text">{fieldTypeButtonText}</span>
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="field-type-button-chevron"
                        >
                            <path
                                d="M3 4.5L6 7.5L9 4.5"
                                stroke="#999"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                    <input
                        type="text"
                        disabled={disabled || !!fieldInfo.altTextForImageFieldId}
                        placeholder={fieldInfo.altTextForImageFieldId ? "" : originalName}
                        value={fieldInfo.altTextForImageFieldId ? "" : name}
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
    previousAltTextMappings: string | null
    databaseIdMap: DatabaseIdMap
}

export function FieldMapping({
    collection,
    dataSource,
    initialSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
    previousAltTextMappings,
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

                const altTextMappings = parseAltTextMappings(previousAltTextMappings)
                setFieldsInfo(mergeFieldsInfoWithExistingFields(initialFieldsInfo, collectionFields, altTextMappings))
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
    }, [initialSlugFieldId, dataSource, collection, initialFieldsInfo, previousAltTextMappings])

    const changeAltTextField = (fieldId: string, altTextForImageFieldId: string | null) => {
        setFieldsInfo(prevFieldsInfo => {
            const updatedFieldInfo = prevFieldsInfo.map((fieldInfo): FieldInfo => {
                if (fieldInfo.id !== fieldId) return fieldInfo
                return { ...fieldInfo, type: "string", altTextForImageFieldId }
            })
            return updatedFieldInfo
        })
    }

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
                if (fieldInfo.id !== fieldId) {
                    if (fieldInfo.altTextForImageFieldId === fieldId) {
                        return { ...fieldInfo, altTextForImageFieldId: undefined }
                    }

                    return fieldInfo
                }

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

                await syncCollection(
                    collection,
                    dataSource,
                    fieldsToSync,
                    slugField,
                    ignoredFieldIds,
                    previousLastSynced,
                    fieldsInfo
                )
                framer.closePlugin("Synchronization successful", { variant: "success" })
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
                            fieldsInfo={fieldsInfo}
                            ignoredFieldIds={ignoredFieldIds}
                            onToggleIgnored={toggleFieldIgnoredState}
                            onNameChange={changeFieldName}
                            onFieldTypeChange={changeFieldType}
                            onAltTextFieldChange={changeAltTextField}
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
