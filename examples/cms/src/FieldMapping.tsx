import type { DataSource, syncCollection } from "./data"

import { ManagedCollection, ManagedCollectionField, framer } from "framer-plugin"
import { useState, useMemo, useLayoutEffect } from "react"
import { computeFieldsFromDataSource, mergeFieldsWithExistingFields } from "./data"
import { Spinner } from "./components/Spinner"
import { UI_DEFAULTS } from "./constants"

interface FieldMappingRowProps {
    originalField: ManagedCollectionField
    field: ManagedCollectionField
    isIgnored: boolean
    onFieldToggle: (fieldId: string) => void
    onFieldNameChange: (fieldId: string, name: string) => void
}

function FieldMappingRow({ originalField, field, isIgnored, onFieldToggle, onFieldNameChange }: FieldMappingRowProps) {
    const isUnsupported = !field
    const hasFieldNameChanged = field!.name !== originalField.name
    const fieldName = hasFieldNameChanged ? field!.name : ""
    const placeholder = isUnsupported ? "Unsupported Field" : originalField.name
    const isDisabled = isUnsupported || isIgnored

    return (
        <>
            <div
                className="source-field"
                aria-disabled={isDisabled}
                onClick={() => onFieldToggle(field!.id)}
                role="button"
            >
                <input
                    type="checkbox"
                    disabled={isUnsupported}
                    checked={!isDisabled}
                    onChange={event => {
                        event.stopPropagation()
                    }}
                />
                <span>{originalField.name}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="16">
                <path
                    d="M 3 11 L 6 8 L 3 5"
                    fill="transparent"
                    strokeWidth="1.5"
                    stroke="#999"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                ></path>
            </svg>
            <input
                type="text"
                style={{
                    width: "100%",
                    opacity: isDisabled ? 0.5 : 1,
                }}
                disabled={isDisabled}
                placeholder={placeholder}
                value={fieldName || ""}
                onChange={event => {
                    if (!field) return

                    const value = event.target.value
                    if (!value.trim()) {
                        onFieldNameChange(field.id, originalField.name)
                    } else {
                        onFieldNameChange(field.id, value.trimStart())
                    }
                }}
            />
        </>
    )
}

interface FieldMappingProps {
    collection: ManagedCollection
    existingFields: ManagedCollectionField[]
    dataSource: DataSource
    slugFieldId: string | null
    onImport: typeof syncCollection
}

export function FieldMapping({ collection, existingFields, dataSource, slugFieldId, onImport }: FieldMappingProps) {
    const originalFields = useMemo(() => computeFieldsFromDataSource(dataSource), [dataSource])
    const [fields, setFields] = useState(mergeFieldsWithExistingFields(originalFields, existingFields))

    const [disabledFieldIds, setDisabledFieldIds] = useState<Set<string>>(() => {
        if (existingFields.length === 0) {
            return new Set()
        }

        return new Set(
            fields
                .filter(field => !existingFields.find(existingField => existingField.id === field.id))
                .map(field => field.id)
        )
    })

    const possibleSlugFields = useMemo(() => {
        return fields.filter(field => {
            const isStringType = field.type === "string"
            const isEnabled = !disabledFieldIds.has(field.id)

            return isStringType && isEnabled
        })
    }, [fields, disabledFieldIds])

    const [selectedSlugFieldId, setSelectedSlugFieldId] = useState<string | null>(
        slugFieldId ?? possibleSlugFields[0]?.id ?? null
    )

    const [isSyncing, setIsSyncing] = useState(false)

    const handleFieldNameChange = (fieldId: string, name: string) => {
        setFields(prev => prev.map(field => (field.id === fieldId ? { ...field, name } : field)))
    }

    const handleFieldToggle = (fieldId: string) => {
        setDisabledFieldIds(prev => {
            const updatedDisabledFieldIds = new Set(prev)
            const isEnabling = updatedDisabledFieldIds.has(fieldId)

            if (isEnabling) {
                updatedDisabledFieldIds.delete(fieldId)
            } else {
                updatedDisabledFieldIds.add(fieldId)
            }

            // Handle slug field updates
            const field = fields.find(field => field.id === fieldId)
            if (field?.type !== "string") {
                return updatedDisabledFieldIds
            }

            if (isEnabling && (!slugFieldId || prev.has(slugFieldId))) {
                // When enabling a string field and there is no valid slug field, make it the slug
                setSelectedSlugFieldId(fieldId)
            } else if (!isEnabling && fieldId === slugFieldId) {
                // When disabling the current slug field, find next available one
                const nextSlugField = possibleSlugFields.find(f => f.id !== fieldId)
                setSelectedSlugFieldId(nextSlugField?.id ?? null)
            }

            return updatedDisabledFieldIds
        })
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedSlugFieldId) {
            framer.notify("Slug field is required", {
                variant: "error",
            })
            return
        }

        try {
            setIsSyncing(true)
            await onImport(
                collection,
                dataSource,
                fields.filter(field => !disabledFieldIds.has(field.id)),
                selectedSlugFieldId
            )
            await framer.closePlugin(`Synchronization successful`, {
                variant: "success",
            })
        } catch (error) {
            console.error(error)
            framer.notify(`Failed to sync collection ${dataSource.id}`, {
                variant: "error",
            })
        } finally {
            setIsSyncing(false)
        }
    }

    useLayoutEffect(() => {
        framer.showUI({
            width: UI_DEFAULTS.MAPPING_WIDTH,
            height: UI_DEFAULTS.MAPPING_HEIGHT,
            minWidth: UI_DEFAULTS.MAPPING_WIDTH,
            minHeight: UI_DEFAULTS.MAPPING_HEIGHT,
            resizable: true,
        })
    }, [])

    return (
        <main className="mapping">
            <hr className="sticky-top" />
            <form onSubmit={handleSubmit}>
                <label className="slug-field" htmlFor="slugField">
                    Slug Field
                    <select
                        name="slugField"
                        className="field-input"
                        value={selectedSlugFieldId ?? ""}
                        onChange={event => setSelectedSlugFieldId(event.target.value)}
                        required
                    >
                        {possibleSlugFields.map(field => {
                            if (!field) return null
                            return (
                                <option key={field.id} value={field.id}>
                                    {field.name}
                                </option>
                            )
                        })}
                    </select>
                </label>

                <div className="fields">
                    <span className="column-span-2">Column</span>
                    <span>Field</span>
                    {fields.map((field, i) => (
                        <FieldMappingRow
                            key={field.id || i}
                            originalField={originalFields.find(originalField => originalField.id === field.id)!}
                            field={field}
                            isIgnored={disabledFieldIds.has(field.id)}
                            onFieldToggle={handleFieldToggle}
                            onFieldNameChange={handleFieldNameChange}
                        />
                    ))}
                </div>

                <footer>
                    <hr className="sticky-top" />
                    <button style={{ position: "relative" }} disabled={isSyncing}>
                        {isSyncing ? (
                            <Spinner inheritColor />
                        ) : (
                            <span>
                                Import <span style={{ textTransform: "capitalize" }}>{dataSource.id}</span>
                            </span>
                        )}
                    </button>
                </footer>
            </form>
        </main>
    )
}
