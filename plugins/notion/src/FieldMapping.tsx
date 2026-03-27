import classNames from "classnames"
import {
    FramerPluginClosedError,
    framer,
    type ManagedCollection,
    type ManagedCollectionField,
    type NormalMenuItem,
    useIsAllowedTo,
    type MenuItem,
} from "framer-plugin"
import { useEffect, useMemo, useRef, useState } from "react"
import {
    type FieldId,
    type FieldInfo,
    getDatabaseFieldsInfo,
    getPossibleSlugFieldIds,
    isMissingCollection,
    type VirtualFieldType,
} from "./api"
import {
    type DatabaseIdMap,
    type DataSource,
    fieldsInfoToCollectionFields,
    getViewOptionsForDataSource,
    mergeFieldsInfoWithExistingFields,
    parseIgnoredFieldIds,
    type SyncProgress,
    syncCollection,
    VIEW_TYPE_LABELS,
} from "./data"
import { Progress } from "./Progress"
import { assert, syncMethods } from "./utils"

const labelByFieldTypeOption: Record<VirtualFieldType, string> = {
    boolean: "Toggle",
    date: "Date",
    dateTime: "Date & Time",
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
    onFieldTypeChange: (fieldId: string, type: VirtualFieldType) => void
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
    setIsSyncing: (isSyncing: boolean) => void
}

export function FieldMapping({
    collection,
    dataSource,
    initialSlugFieldId,
    previousLastSynced,
    previousIgnoredFieldIds,
    databaseIdMap,
    setIsSyncing,
}: FieldMappingProps) {
    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const [status, setStatus] = useState<"mapping-fields" | "loading-fields" | "syncing-collection">(
        initialSlugFieldId ? "loading-fields" : "mapping-fields"
    )
    const isSyncing = status === "syncing-collection"
    const isLoadingFields = status === "loading-fields"

    const dataSourceName = dataSource.name
    const schema = dataSource.schema

    const initialFieldsInfo = useMemo(() => getDatabaseFieldsInfo(schema, databaseIdMap), [schema, databaseIdMap])
    const possibleSlugFieldIds = useMemo(() => getPossibleSlugFieldIds(schema), [schema])

    const [selectedSlugFieldId, setSelectedSlugFieldId] = useState<FieldId | null>(
        initialSlugFieldId ?? possibleSlugFieldIds[0] ?? null
    )

    const [fieldsInfo, setFieldsInfo] = useState(initialFieldsInfo)
    const [ignoredFieldIds, setIgnoredFieldIds] = useState(parseIgnoredFieldIds(previousIgnoredFieldIds))
    const [existingFields, setExistingFields] = useState<ManagedCollectionField[]>([])
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
    const [selectedViewId, setSelectedViewId] = useState<string | null>(dataSource.viewId)
    const [viewOptions, setViewOptions] = useState<{ id: string; name: string; type: string }[]>([])
    const [showAllItemsOption, setShowAllItemsOption] = useState(false)
    const viewControlRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setSelectedViewId(dataSource.viewId)
    }, [dataSource.viewId])

    useEffect(() => {
        let cancelled = false

        const task = async () => {
            try {
                const { views, showAllItemsOption } = await getViewOptionsForDataSource(
                    dataSource.id,
                    dataSource.dataSourceId
                )
                if (cancelled) return
                setViewOptions(views.map(({ id, name, type }) => ({ id, name, type })))
                setShowAllItemsOption(showAllItemsOption)
            } catch (error) {
                if (cancelled) return
                console.error("Failed to load view options:", error)
                setViewOptions([])
                setShowAllItemsOption(false)
            }
        }

        void task()
        return () => {
            cancelled = true
        }
    }, [dataSource.id, dataSource.dataSourceId])

    useEffect(() => {
        const abortController = new AbortController()

        collection
            .getFields()
            .then(collectionFields => {
                if (abortController.signal.aborted) return

                setExistingFields(collectionFields)
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

    const openViewMenu = () => {
        if (isSyncing || isLoadingFields || !isAllowedToManage) return

        const rect = viewControlRef.current?.getBoundingClientRect()
        const items: MenuItem[] = []

        if (showAllItemsOption) {
            items.push(
                {
                    label: "All Items",
                    checked: selectedViewId === null,
                    onAction: () => {
                        setSelectedViewId(null)
                    },
                },
                { type: "separator" }
            )
        }

        const viewMenuItems: NormalMenuItem[] = viewOptions.map(({ id, name, type }) => {
            const viewType = VIEW_TYPE_LABELS[type] ?? type
            return {
                label: name,
                checked: selectedViewId === id,
                secondaryLabel: viewType,
                onAction: () => {
                    setSelectedViewId(id)
                },
            }
        })

        items.push(...viewMenuItems)
        if (items.length === 0) return

        void framer.showContextMenu(items, {
            location: {
                x: (rect?.left ?? 0) + 4,
                y: (rect?.bottom ?? 0) + 4,
            },
            width: rect?.width ?? 0,
            placement: "bottom-right",
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

    const changeFieldType = (fieldId: string, type: VirtualFieldType) => {
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
                setIsSyncing(true)
                setSyncProgress(null)
                await framer.setCloseWarning("Synchronization in progress. Closing will cancel the sync.")

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
                    { ...dataSource, viewId: selectedViewId },
                    fieldsToSync,
                    slugField,
                    ignoredFieldIds,
                    previousLastSynced,
                    existingFields,
                    setSyncProgress
                )
                // framer.closePlugin("Synchronization successful", { variant: "success" })
            } catch (error) {
                if (error instanceof FramerPluginClosedError) return
                console.error(error)
                framer.notify(
                    error instanceof Error
                        ? error.message
                        : `Failed to sync collection "${dataSource.name || dataSource.id}"`,
                    { variant: "error", durationMs: Infinity }
                )
            } finally {
                await framer.setCloseWarning(false)
                setStatus("mapping-fields")
                setIsSyncing(false)
                setSyncProgress(null)
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

    if (isSyncing) {
        return (
            <Progress
                current={syncProgress?.current ?? 0}
                total={syncProgress?.total ?? 0}
                contentFieldEnabled={syncProgress?.contentFieldEnabled ?? true}
                hasFinishedLoading={syncProgress?.hasFinishedLoading ?? false}
            />
        )
    }

    return (
        <main className="framer-hide-scrollbar mapping">
            <hr className="sticky-divider" />
            <form onSubmit={handleSubmit}>
                <div ref={viewControlRef} className="field-container">
                    <span>View</span>
                    <div
                        className="view-dropdown field-input"
                        onClick={openViewMenu}
                        role="button"
                        tabIndex={!isAllowedToManage ? -1 : 0}
                        aria-disabled={!isAllowedToManage}
                    >
                        {selectedViewId
                            ? (viewOptions.find(view => view.id === selectedViewId)?.name ?? selectedViewId)
                            : "All Items"}
                    </div>
                </div>
                <label className="field-container" htmlFor="slugField">
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
                        className="import-button"
                        disabled={!isAllowedToManage}
                        tabIndex={0}
                        title={!isAllowedToManage ? "Insufficient permissions" : undefined}
                    >
                        <span>Import from {dataSourceName.trim() ? dataSourceName : "Untitled"}</span>
                    </button>
                </footer>
            </form>
        </main>
    )
}
