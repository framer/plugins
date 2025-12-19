import type { Collection, Field } from "framer-plugin"
import { framer } from "framer-plugin"
import { useCallback, useEffect, useMemo, useState } from "react"
import { type InferredField, inferFieldsFromCSV } from "../utils/typeInference"

const labelByFieldType: Record<Field["type"], string> = {
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
    divider: "Divider",
    unsupported: "Unsupported",
}

/**
 * Check if a CSV column's inferred type can be imported into a target field type.
 * Some field types are more general and can accept values from other types.
 *
 * - Plain Text & Formatted Text: accept anything (most general)
 * - Link: accepts link, string
 * - Image: accepts image, link, string
 * - File: accepts file, image, link, string
 * - Number, Boolean, Date, Color: only accept their own type
 */
function isTypeCompatible(sourceType: Field["type"], targetType: Field["type"]): boolean {
    // Same type is always compatible
    if (sourceType === targetType) return true

    // Plain Text and Formatted Text can accept anything
    if (targetType === "string" || targetType === "formattedText") return true

    // Link can accept strings (URLs are detected as strings sometimes)
    if (targetType === "link" && sourceType === "string") return true

    // Image can accept link or string
    if (targetType === "image" && (sourceType === "link" || sourceType === "string")) return true

    // File can accept image, link, or string
    if (targetType === "file" && (sourceType === "image" || sourceType === "link" || sourceType === "string")) {
        return true
    }

    // Enum can accept strings
    if (targetType === "enum" && sourceType === "string") return true

    // Strict types: number, boolean, date, color only accept their own type
    return false
}

export type MappingAction = "create" | "map" | "ignore"

export interface FieldMappingItem {
    inferredField: InferredField
    action: MappingAction
    /** The existing field ID to map to (when action is "map") */
    targetFieldId?: string
    /** Whether types are compatible when mapping */
    hasTypeMismatch: boolean
    /** Override the inferred type when creating a new field */
    overrideType?: Field["type"]
}

export type MissingFieldAction = "ignore" | "remove"

export interface MissingFieldItem {
    field: Field
    action: MissingFieldAction
}

export interface FieldMapperSubmitOpts {
    mappings: FieldMappingItem[]
    slugFieldName: string
    missingFields: MissingFieldItem[]
}

interface FieldMapperProps {
    collection: Collection
    csvRecords: Record<string, string>[]
    onSubmit: (opts: FieldMapperSubmitOpts) => Promise<void>
    onCancel: () => Promise<void>
}

interface FieldMapperRowProps {
    item: FieldMappingItem
    existingFields: Field[]
    isSlug: boolean
    onToggleIgnored: () => void
    onSetIgnored: (ignored: boolean) => void
    onTargetChange: (targetFieldId: string | null) => void
    onTypeChange: (type: Field["type"]) => void
}

function FieldMapperRow({
    item,
    existingFields,
    isSlug,
    onToggleIgnored,
    onSetIgnored,
    onTargetChange,
    onTypeChange,
}: FieldMapperRowProps) {
    const { inferredField, action, targetFieldId, hasTypeMismatch, overrideType } = item
    const isIgnored = action === "ignore"

    // Find the target field when mapping to an existing field
    const targetField = targetFieldId ? existingFields.find(f => f.id === targetFieldId) : null

    // Determine the type to display in the Type selector
    const displayType =
        action === "map" && targetField
            ? targetField.type // Show existing field's type when mapping
            : (overrideType ?? inferredField.inferredType) // Show inferred/override type when creating

    // Type selector is editable only when creating a new field with multiple allowed types
    const canEditType = action === "create" && inferredField.allowedTypes.length > 1

    return (
        <>
            <button
                type="button"
                className={`source-field ${isIgnored ? "ignored" : ""} ${isSlug ? "is-slug" : ""}`}
                aria-disabled={isIgnored}
                onClick={() => {
                    onToggleIgnored()
                }}
                tabIndex={0}
            >
                <input type="checkbox" checked={!isIgnored} tabIndex={-1} readOnly />
                <span>{inferredField.columnName}</span>
                <span className="inferred-type">{labelByFieldType[inferredField.inferredType]}</span>
            </button>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="8"
                height="8"
                fill="none"
                style={{ opacity: isIgnored ? 0.5 : 1 }}
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
            <select
                className="field-input"
                disabled={isIgnored}
                value={isIgnored ? "__ignore__" : action === "create" ? "__create__" : (targetFieldId ?? "")}
                onChange={e => {
                    const value = e.target.value
                    if (value === "__ignore__") {
                        onSetIgnored(true)
                    } else if (value === "__create__") {
                        onSetIgnored(false)
                        onTargetChange(null)
                    } else {
                        onSetIgnored(false)
                        onTargetChange(value)
                    }
                }}
            >
                <option value="__create__">+ Create field</option>
                <option value="__ignore__">− Ignore column</option>
                <optgroup label="Existing fields">
                    {existingFields.map(field => (
                        <option key={field.id} value={field.id}>
                            {field.name}
                        </option>
                    ))}
                </optgroup>
            </select>
            <select
                className="field-type"
                disabled={isIgnored || !canEditType}
                value={displayType}
                onChange={e => {
                    onTypeChange(e.target.value as Field["type"])
                }}
            >
                {canEditType ? (
                    inferredField.allowedTypes.map(type => (
                        <option key={type} value={type}>
                            {labelByFieldType[type]}
                        </option>
                    ))
                ) : (
                    <option value={displayType}>{labelByFieldType[displayType]}</option>
                )}
            </select>
            {hasTypeMismatch && !isIgnored && (
                <div className="mismatch-warning">Type mismatch. Incompatible values will be skipped.</div>
            )}
        </>
    )
}

export function FieldMapper({ collection, csvRecords, onSubmit, onCancel }: FieldMapperProps) {
    const [existingFields, setExistingFields] = useState<Field[]>([])
    const [mappings, setMappings] = useState<FieldMappingItem[]>([])
    const [missingFields, setMissingFields] = useState<MissingFieldItem[]>([])
    const [selectedSlugFieldName, setSelectedSlugFieldName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Load existing fields and create initial mappings
    useEffect(() => {
        async function loadFields() {
            try {
                const fields = await collection.getFields()
                setExistingFields(fields)

                // Track which existing fields get mapped
                const mappedFieldIds = new Set<string>()

                const inferredFields = inferFieldsFromCSV(csvRecords)

                // Create initial mappings based on name matching
                const initialMappings: FieldMappingItem[] = inferredFields.map(inferredField => {
                    // Try to find an existing field with matching name
                    const matchingField = fields.find(f => f.name.toLowerCase() === inferredField.name.toLowerCase())

                    if (matchingField) {
                        // Found a match - check type compatibility
                        const hasTypeMismatch = !isTypeCompatible(inferredField.inferredType, matchingField.type)
                        mappedFieldIds.add(matchingField.id)
                        return {
                            inferredField,
                            action: "map" as const,
                            targetFieldId: matchingField.id,
                            hasTypeMismatch,
                        }
                    }

                    // No match - create new field
                    return {
                        inferredField,
                        action: "create" as const,
                        hasTypeMismatch: false,
                    }
                })

                setMappings(initialMappings)

                // Find fields that exist in collection but are not mapped from CSV
                const initialMissingFields: MissingFieldItem[] = fields
                    .filter(field => !mappedFieldIds.has(field.id))
                    .map(field => ({
                        field,
                        action: "ignore" as const,
                    }))

                setMissingFields(initialMissingFields)
            } catch (error) {
                console.error("Error loading fields:", error)
                framer.notify("Error loading collection fields", { variant: "error" })
            } finally {
                setLoading(false)
            }
        }

        void loadFields()
    }, [collection, csvRecords])

    // Determine possible slug fields (fields that have values in every record)
    const possibleSlugFields = useMemo(() => {
        return mappings
            .filter(m => m.action !== "ignore")
            .filter(m => csvRecords.every(record => record[m.inferredField.columnName]))
            .map(m => m.inferredField)
    }, [csvRecords, mappings])

    // Auto-select first possible slug field
    useEffect(() => {
        if (possibleSlugFields.length > 0 && !selectedSlugFieldName) {
            setSelectedSlugFieldName(possibleSlugFields[0]?.columnName ?? null)
        }
    }, [possibleSlugFields, selectedSlugFieldName])

    const toggleIgnored = useCallback(
        (columnName: string) => {
            setMappings(prev => {
                const currentItem = prev.find(item => item.inferredField.columnName === columnName)
                const willBeIgnored = currentItem?.action !== "ignore"

                const newMappings = prev.map(item => {
                    if (item.inferredField.columnName !== columnName) return item

                    if (item.action === "ignore") {
                        // Un-ignore: restore to create mode
                        return { ...item, action: "create" as const, targetFieldId: undefined, hasTypeMismatch: false }
                    } else {
                        // Ignore
                        return { ...item, action: "ignore" as const, targetFieldId: undefined, hasTypeMismatch: false }
                    }
                })

                // If ignoring the current slug field, switch to another available one
                if (willBeIgnored && columnName === selectedSlugFieldName) {
                    const newSlugField = newMappings
                        .filter(m => m.action !== "ignore")
                        .find(m => csvRecords.every(record => record[m.inferredField.columnName]))

                    setSelectedSlugFieldName(newSlugField?.inferredField.columnName ?? null)
                }

                return newMappings
            })
        },
        [selectedSlugFieldName, csvRecords]
    )

    const setIgnored = useCallback(
        (columnName: string, ignored: boolean) => {
            setMappings(prev => {
                const newMappings = prev.map(item => {
                    if (item.inferredField.columnName !== columnName) return item

                    if (ignored) {
                        return { ...item, action: "ignore" as const, targetFieldId: undefined, hasTypeMismatch: false }
                    } else if (item.action === "ignore") {
                        // Un-ignore: restore to create mode
                        return { ...item, action: "create" as const, targetFieldId: undefined, hasTypeMismatch: false }
                    }
                    return item
                })

                // If ignoring the current slug field, switch to another available one
                if (ignored && columnName === selectedSlugFieldName) {
                    const newSlugField = newMappings
                        .filter(m => m.action !== "ignore")
                        .find(m => csvRecords.every(record => record[m.inferredField.columnName]))

                    setSelectedSlugFieldName(newSlugField?.inferredField.columnName ?? null)
                }

                return newMappings
            })
        },
        [selectedSlugFieldName, csvRecords]
    )

    const updateTarget = useCallback(
        (columnName: string, targetFieldId: string | null) => {
            setMappings(prev => {
                const newMappings = prev.map(item => {
                    if (item.inferredField.columnName !== columnName) return item

                    if (targetFieldId === null) {
                        // Create new field
                        return {
                            ...item,
                            action: "create" as const,
                            targetFieldId: undefined,
                            hasTypeMismatch: false,
                        }
                    }

                    // Map to existing field
                    const targetField = existingFields.find(f => f.id === targetFieldId)
                    const hasTypeMismatch = targetField
                        ? !isTypeCompatible(item.inferredField.inferredType, targetField.type)
                        : false

                    return {
                        ...item,
                        action: "map" as const,
                        targetFieldId,
                        hasTypeMismatch,
                    }
                })

                // Update missing fields based on new mappings
                const mappedFieldIds = new Set(
                    newMappings.filter(m => m.action === "map" && m.targetFieldId).map(m => m.targetFieldId)
                )

                setMissingFields(prev => {
                    const prevActionMap = new Map(prev.map(item => [item.field.id, item.action]))

                    return existingFields
                        .filter(field => !mappedFieldIds.has(field.id))
                        .map(field => ({
                            field,
                            action: prevActionMap.get(field.id) ?? ("ignore" as MissingFieldAction),
                        }))
                })

                return newMappings
            })
        },
        [existingFields]
    )

    const updateMissingFieldAction = useCallback((fieldId: string, action: MissingFieldAction) => {
        setMissingFields(prev => prev.map(item => (item.field.id === fieldId ? { ...item, action } : item)))
    }, [])

    const updateType = useCallback((columnName: string, type: Field["type"]) => {
        setMappings(prev =>
            prev.map(item => {
                if (item.inferredField.columnName !== columnName) return item
                return { ...item, overrideType: type }
            })
        )
    }, [])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedSlugFieldName) {
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        // Check if the slug field is being ignored
        const slugMapping = mappings.find(m => m.inferredField.columnName === selectedSlugFieldName)
        if (slugMapping?.action === "ignore") {
            framer.notify("The slug field cannot be ignored.", { variant: "warning" })
            return
        }

        // Check if all required fields are mapped
        if (unmappedRequiredFields.length > 0) {
            framer.notify("All required fields must be mapped before importing.", { variant: "warning" })
            return
        }

        await onSubmit({ mappings, slugFieldName: selectedSlugFieldName, missingFields })
    }

    // Find required fields that are not mapped to any CSV column
    const unmappedRequiredFields = useMemo(() => {
        const mappedFieldIds = new Set(
            mappings.filter(m => m.action === "map" && m.targetFieldId).map(m => m.targetFieldId)
        )
        return existingFields.filter(field => "required" in field && field.required && !mappedFieldIds.has(field.id))
    }, [existingFields, mappings])

    const canSubmit = unmappedRequiredFields.length === 0

    // Summary stats
    const stats = useMemo(() => {
        const active = mappings.filter(m => m.action !== "ignore")
        return {
            total: mappings.length,
            ignored: mappings.filter(m => m.action === "ignore").length,
            creating: mappings.filter(m => m.action === "create").length,
            matched: active.filter(m => m.action === "map" && !m.hasTypeMismatch).length,
            mismatched: active.filter(m => m.action === "map" && m.hasTypeMismatch).length,
        }
    }, [mappings])

    if (loading) {
        return (
            <main className="framer-hide-scrollbar field-mapper">
                <div className="loading">Loading fields...</div>
            </main>
        )
    }

    return (
        <main className="framer-hide-scrollbar field-mapper">
            <hr className="sticky-divider" />
            <form onSubmit={e => void handleSubmit(e)}>
                <div className="mapper-summary">
                    <span className="summary-stat">
                        <strong>{stats.total}</strong> columns
                    </span>
                    {stats.matched > 0 && (
                        <span className="summary-stat matched">
                            <strong>{stats.matched}</strong> matched
                        </span>
                    )}
                    {stats.creating > 0 && (
                        <span className="summary-stat creating">
                            <strong>{stats.creating}</strong> new
                        </span>
                    )}
                    {stats.mismatched > 0 && (
                        <span className="summary-stat mismatched">
                            <strong>{stats.mismatched}</strong> type issues
                        </span>
                    )}
                    {stats.ignored > 0 && (
                        <span className="summary-stat ignored">
                            <strong>{stats.ignored}</strong> ignored
                        </span>
                    )}
                </div>

                <label className="slug-field" htmlFor="slugField">
                    <span>Slug Field</span>
                    <select
                        required
                        name="slugField"
                        className="field-input"
                        value={selectedSlugFieldName ?? ""}
                        onChange={event => {
                            setSelectedSlugFieldName(event.target.value)
                        }}
                    >
                        {possibleSlugFields.map(field => (
                            <option key={`slug-field-${field.columnName}`} value={field.columnName}>
                                {field.name || field.columnName}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="fields">
                    <span className="fields-column">CSV Column</span>
                    <span>Target Field</span>
                    <span>Type</span>
                    {mappings.map(item => (
                        <FieldMapperRow
                            key={item.inferredField.columnName}
                            item={item}
                            existingFields={existingFields}
                            isSlug={item.inferredField.columnName === selectedSlugFieldName}
                            onToggleIgnored={() => {
                                toggleIgnored(item.inferredField.columnName)
                            }}
                            onSetIgnored={ignored => {
                                setIgnored(item.inferredField.columnName, ignored)
                            }}
                            onTargetChange={targetId => {
                                updateTarget(item.inferredField.columnName, targetId)
                            }}
                            onTypeChange={type => {
                                updateType(item.inferredField.columnName, type)
                            }}
                        />
                    ))}
                </div>

                {missingFields.length > 0 && (
                    <div className="missing-fields-section">
                        <div className="missing-fields-header">
                            <span>Unmapped Fields</span>
                        </div>
                        {missingFields.map(item => (
                            <div key={item.field.id} className="missing-field-row">
                                <div className="missing-field-info">
                                    <span className="field-name">{item.field.name}</span>
                                    <span className="field-type">{labelByFieldType[item.field.type]}</span>
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="8"
                                    height="8"
                                    fill="none"
                                    style={{ opacity: 1 }}
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
                                <select
                                    className="missing-field-action"
                                    value={item.action}
                                    onChange={e => {
                                        updateMissingFieldAction(item.field.id, e.target.value as MissingFieldAction)
                                    }}
                                >
                                    <option value="ignore">Keep field</option>
                                    <option value="remove">Remove field</option>
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {unmappedRequiredFields.length > 0 && (
                    <div className="unmapped-required-section">
                        <div className="unmapped-required-header">
                            <span className="warning-icon">⚠</span>
                            <span>Required fields without data</span>
                        </div>
                        <div className="unmapped-required-list">
                            {unmappedRequiredFields.map(field => (
                                <div key={field.id} className="unmapped-required-item">
                                    <span className="field-name">{field.name}</span>
                                    <span className="field-type">{labelByFieldType[field.type]}</span>
                                </div>
                            ))}
                        </div>
                        <p className="unmapped-required-hint">
                            Map a CSV column to these fields, or imported items will have empty values.
                        </p>
                    </div>
                )}

                <footer>
                    <div className="actions">
                        <button type="button" onClick={() => void onCancel()}>
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="framer-button-primary"
                            disabled={!canSubmit}
                            title={
                                unmappedRequiredFields.length > 0 ? "Map all required fields to continue" : undefined
                            }
                        >
                            Import {csvRecords.length} {csvRecords.length === 1 ? "item" : "items"}
                        </button>
                    </div>
                </footer>
            </form>
        </main>
    )
}
