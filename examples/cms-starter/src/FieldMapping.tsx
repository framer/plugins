import { ManagedCollectionField, framer } from "framer-plugin"
import { useState, useMemo, useLayoutEffect } from "react"
import { Fragment } from "react/jsx-runtime"
import { DataSource, FieldConfig, computeFieldConfigs } from "./data"
import { isNotNull } from "./utils"

interface FieldMappingRowProps {
    fieldConfig: FieldConfig
    isIgnored: boolean
    onFieldToggle: (fieldId: string) => void
    onFieldNameChange: (fieldId: string, name: string) => void
}

function FieldMappingRow({ fieldConfig, isIgnored, onFieldToggle, onFieldNameChange }: FieldMappingRowProps) {
    const field = fieldConfig.field

    const isUnsupported = !field
    const hasFieldNameChanged = field!.name !== fieldConfig.name
    const fieldName = hasFieldNameChanged ? field!.name : ""
    const placeholder = isUnsupported ? "Unsupported Field" : fieldConfig.name

    const isDisabled = useMemo(() => isUnsupported || isIgnored, [isUnsupported, isIgnored])

    return (
        <Fragment>
            <div
                className="source-field"
                aria-disabled={isDisabled}
                onClick={() => onFieldToggle(fieldConfig.field!.id)}
                role="button"
            >
                <input
                    type="checkbox"
                    disabled={isUnsupported}
                    checked={!isDisabled}
                    onChange={e => {
                        e.stopPropagation()
                    }}
                />
                <span>{fieldConfig.name}</span>
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
                onChange={e => {
                    if (!field) return
                    if (!e.target.value.trim()) {
                        onFieldNameChange(field.id, fieldConfig.name)
                    } else {
                        onFieldNameChange(field.id, e.target.value)
                    }
                }}
            />
        </Fragment>
    )
}

export function FieldMapping({
    savedFieldsConfig,
    existingFields,
    dataSource,
    savedSlugFieldId,
    onSubmit,
}: {
    savedFieldsConfig: FieldConfig[] | undefined
    existingFields: ManagedCollectionField[]
    dataSource: DataSource
    savedSlugFieldId: string | null
    onSubmit: (dataSource: DataSource, fields: FieldConfig[], slugFieldId: string) => Promise<void>
}) {
    const [fields, setFields] = useState<FieldConfig[]>(
        savedFieldsConfig ?? computeFieldConfigs(existingFields, dataSource)
    )
    const [disabledFieldIds, setDisabledFieldIds] = useState<Set<string>>(
        new Set(savedFieldsConfig?.filter(field => field.isNew).map(field => field.field!.id))
    )

    const possibleSlugFields = useMemo(
        () =>
            fields
                .map(field => field.field)
                .filter(isNotNull)
                .filter(field => !disabledFieldIds.has(field.id) && field.type === "string"),
        [fields, disabledFieldIds]
    )
    const [slugFieldId, setSlugFieldId] = useState<string | null>(savedSlugFieldId ?? possibleSlugFields[0]?.id ?? null)

    const [isSyncing, setIsSyncing] = useState(false)

    const handleFieldNameChange = (fieldId: string, name: string) => {
        setFields(prev =>
            prev.map(field => (field.field?.id === fieldId ? { ...field, field: { ...field.field, name } } : field))
        )
    }

    const handleFieldToggle = (fieldId: string) => {
        setDisabledFieldIds(current => {
            const nextSet = new Set(current)
            if (nextSet.has(fieldId)) {
                nextSet.delete(fieldId)

                // If we're re-enabling a string field and there's no valid slug field,
                // set this field as the slug field
                const field = fields.find(field => field.field?.id === fieldId)
                if (field?.field?.type === "string") {
                    const currentSlugField = fields.find(field => field.field?.id === slugFieldId)
                    if (!currentSlugField || nextSet.has(slugFieldId ?? "")) {
                        setSlugFieldId(fieldId)
                    }
                }
            } else {
                nextSet.add(fieldId)

                // If the disabled field is the slug field, update it to the next
                // possible slug field
                if (fieldId === slugFieldId) {
                    const nextSlugField = possibleSlugFields.find(field => field.id !== fieldId)
                    if (nextSlugField) {
                        setSlugFieldId(nextSlugField.id)
                    }
                }
            }
            return nextSet
        })
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!slugFieldId) {
            framer.notify("Slug field is required", {
                variant: "error",
            })
            return
        }

        try {
            setIsSyncing(true)
            await onSubmit(
                dataSource,
                fields.filter(field => field.field && !disabledFieldIds.has(field.field!.id)),
                slugFieldId
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
            width: 360,
            height: 425,
            minWidth: 360,
            minHeight: 425,
            resizable: true,
        })
    }, [])

    return (
        <main className="mapping no-scrollbar">
            <form onSubmit={handleSubmit}>
                <hr className="sticky-top" />
                <label className="slug-field" htmlFor="slugField">
                    Slug Field
                    <select
                        name="slugField"
                        className="field-input"
                        value={slugFieldId ?? ""}
                        onChange={e => setSlugFieldId(e.target.value)}
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
                <div className="mapping-fields">
                    <span className="column-span-2">Column</span>
                    <span>Field</span>
                    {fields.map((field, i) => (
                        <FieldMappingRow
                            key={field.field?.id || i}
                            fieldConfig={field}
                            isIgnored={disabledFieldIds.has(field.field?.id ?? "")}
                            onFieldToggle={handleFieldToggle}
                            onFieldNameChange={handleFieldNameChange}
                        />
                    ))}
                </div>
                <footer>
                    <hr className="sticky-top" />
                    <button className="framer-button-primary" disabled={isSyncing}>
                        {isSyncing ? (
                            "Importing..."
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
