import { ManagedCollectionField, framer } from "framer-plugin"
import { useState, useMemo } from "react"
import { DataSource, FieldConfig, computeFieldConfigs } from "./data"
import { isNotNull } from "./utils"
import { Spinner } from "./components/Spinner"

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
    const isDisabled = isUnsupported || isIgnored

    return (
        <>
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
                    onChange={event => {
                        event.stopPropagation()
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
                onChange={event => {
                    if (!field) return

                    const value = event.target.value.trim()
                    if (!value) {
                        onFieldNameChange(field.id, fieldConfig.name)
                    } else {
                        onFieldNameChange(field.id, value)
                    }
                }}
            />
        </>
    )
}

interface FieldMappingProps {
    savedFieldsConfig: FieldConfig[] | null
    existingFields: ManagedCollectionField[]
    dataSource: DataSource
    savedSlugFieldId: string | null
    onSubmit: (dataSource: DataSource, fields: FieldConfig[], slugFieldId: string) => Promise<void>
}

export function FieldMapping({
    savedFieldsConfig,
    existingFields,
    dataSource,
    savedSlugFieldId,
    onSubmit,
}: FieldMappingProps) {
    const [fieldsConfig, setFieldsConfig] = useState<FieldConfig[]>(
        savedFieldsConfig ?? computeFieldConfigs(existingFields, dataSource)
    )
    const [disabledFieldIds, setDisabledFieldIds] = useState<Set<string>>(
        new Set(savedFieldsConfig?.filter(field => field.isNew).map(field => field.field!.id))
    )

    const possibleSlugFields = useMemo(() => {
        const extractedFields = fieldsConfig.map(fieldConfig => {
            return fieldConfig.field
        })
        const nonNullFields = extractedFields.filter(isNotNull)

        return nonNullFields.filter(field => {
            const isStringType = field.type === "string"
            const isEnabled = !disabledFieldIds.has(field.id)

            return isStringType && isEnabled
        })
    }, [fieldsConfig, disabledFieldIds])

    const [slugFieldId, setSlugFieldId] = useState<string | null>(savedSlugFieldId ?? possibleSlugFields[0]?.id ?? null)

    const [isSyncing, setIsSyncing] = useState(false)

    const handleFieldNameChange = (fieldId: string, name: string) => {
        setFieldsConfig(prev =>
            prev.map(fieldConfig =>
                fieldConfig.field?.id === fieldId
                    ? { ...fieldConfig, field: { ...fieldConfig.field, name } }
                    : fieldConfig
            )
        )
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
            const fieldConfig = fieldsConfig.find(fieldConfig => fieldConfig.field?.id === fieldId)
            if (fieldConfig?.field?.type !== "string") {
                return updatedDisabledFieldIds
            }

            if (isEnabling && (!slugFieldId || prev.has(slugFieldId))) {
                // When enabling a string field and there is no valid slug field, make it the slug
                setSlugFieldId(fieldId)
            } else if (!isEnabling && fieldId === slugFieldId) {
                // When disabling the current slug field, find next available one
                const nextSlugField = possibleSlugFields.find(f => f.id !== fieldId)
                setSlugFieldId(nextSlugField?.id ?? null)
            }

            return updatedDisabledFieldIds
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
                fieldsConfig.filter(field => field.field && !disabledFieldIds.has(field.field!.id)),
                slugFieldId
            )
            await new Promise(resolve => setTimeout(resolve, 5000))
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

    return (
        <main className="mapping">
            <hr className="sticky-top" />
            <form onSubmit={handleSubmit}>
                <label className="slug-field" htmlFor="slugField">
                    Slug Field
                    <select
                        name="slugField"
                        className="field-input"
                        value={slugFieldId ?? ""}
                        onChange={event => setSlugFieldId(event.target.value)}
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
                    {fieldsConfig.map((fieldConfig, i) => (
                        <FieldMappingRow
                            key={fieldConfig.field?.id || i}
                            fieldConfig={fieldConfig}
                            isIgnored={disabledFieldIds.has(fieldConfig.field?.id ?? "")}
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
