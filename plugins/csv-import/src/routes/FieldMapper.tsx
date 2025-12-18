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

type MappingStatus = "perfect" | "mismatch" | "create" | "ignored"

const statusColors: Record<MappingStatus, string> = {
    perfect: "var(--framer-color-text-positive, #34C759)",
    mismatch: "var(--framer-color-warning, #FF9500)",
    create: "var(--framer-color-tint, #0099FF)",
    ignored: "var(--framer-color-text-tertiary)",
}

const statusTitles: Record<MappingStatus, string> = {
    perfect: "Exact match",
    mismatch: "Type mismatch",
    create: "New field",
    ignored: "Ignored",
}
function StatusDot({ status }: { status: MappingStatus }) {
    return (
        <span className="status-dot" style={{ backgroundColor: statusColors[status] }} title={statusTitles[status]} />
    )
}

interface FieldMapperRowProps {
    item: FieldMappingItem
    existingFields: Field[]
    isSlug: boolean
    onToggleIgnored: () => void
    onSetIgnored: (ignored: boolean) => void
    onTargetChange: (targetFieldId: string | null) => void
}

function FieldMapperRow({
    item,
    existingFields,
    isSlug,
    onToggleIgnored,
    onSetIgnored,
    onTargetChange,
}: FieldMapperRowProps) {
    const { inferredField, action, targetFieldId, hasTypeMismatch } = item
    const isIgnored = action === "ignore"

    const getStatus = (): MappingStatus => {
        if (isIgnored) {
            return "ignored"
        }
        if (action === "create") {
            return "create"
        }
        if (hasTypeMismatch) {
            return "mismatch"
        }
        return "perfect"
    }

    const status = getStatus()

    // Find the target field for display
    const targetField = targetFieldId ? existingFields.find(f => f.id === targetFieldId) : null

    return (
        <div
            className={`mapper-row ${isIgnored ? "ignored" : ""} ${hasTypeMismatch && !isIgnored ? "has-mismatch" : ""} ${isSlug ? "is-slug" : ""}`}
        >
            {isSlug && <span className="slug-label">Slug</span>}
            <button
                type="button"
                className="mapper-checkbox"
                onClick={onToggleIgnored}
                aria-label={isIgnored ? "Include column" : "Ignore column"}
            >
                <input type="checkbox" checked={!isIgnored} readOnly tabIndex={-1} />
            </button>

            <div className="mapper-source">
                <StatusDot status={status} />
                <span className="column-name" title={inferredField.columnName}>
                    {inferredField.columnName}
                </span>
                <span className="inferred-type">{labelByFieldType[inferredField.inferredType]}</span>
            </div>

            <svg
                className="mapper-arrow"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                style={{ opacity: isIgnored ? 0.3 : 1 }}
            >
                <path
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M2 6h8m-3-3 3 3-3 3"
                />
            </svg>

            <select
                className="mapper-target"
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
                            {field.name} ({labelByFieldType[field.type]})
                        </option>
                    ))}
                </optgroup>
            </select>

            {hasTypeMismatch && !isIgnored && targetField && (
                <div className="mapper-mismatch-row">
                    <span className="mismatch-hint">
                        Type mismatch ({labelByFieldType[inferredField.inferredType]} →{" "}
                        {labelByFieldType[targetField.type]}). Incompatible values will be skipped.
                    </span>
                </div>
            )}
        </div>
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
            unmappedRequired: unmappedRequiredFields.length,
            missing: missingFields.length,
            removing: missingFields.filter(m => m.action === "remove").length,
        }
    }, [mappings, unmappedRequiredFields, missingFields])

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
                <div className="mapper-header">
                    <h3>Map CSV Columns</h3>
                    <div className="mapper-stats">
                        {stats.matched > 0 && (
                            <span className="stat stat-matched">
                                <StatusDot status="perfect" />
                                {stats.matched} matched
                            </span>
                        )}
                        {stats.creating > 0 && (
                            <span className="stat stat-create">
                                <StatusDot status="create" />
                                {stats.creating} new
                            </span>
                        )}
                        {stats.mismatched > 0 && (
                            <span className="stat stat-mismatch">
                                <StatusDot status="mismatch" />
                                {stats.mismatched} type issues
                            </span>
                        )}
                        {stats.ignored > 0 && (
                            <span className="stat stat-ignored">
                                <StatusDot status="ignored" />
                                {stats.ignored} ignored
                            </span>
                        )}
                        {stats.unmappedRequired > 0 && (
                            <span className="stat stat-warning">
                                <span className="warning-icon-small">⚠</span>
                                {stats.unmappedRequired} required
                            </span>
                        )}
                        {stats.missing > 0 && (
                            <span className="stat stat-missing">
                                <span
                                    className="status-dot"
                                    style={{ backgroundColor: "var(--framer-color-text-tertiary)" }}
                                />
                                {stats.missing} missing
                            </span>
                        )}
                    </div>
                </div>

                <label className="slug-field" htmlFor="slugField">
                    <span>Slug Field (Used for conflict resolution)</span>
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

                <div className="mapper-table-header">
                    <span className="col-checkbox" />
                    <span className="col-source">CSV Column</span>
                    <span className="col-arrow" />
                    <span className="col-target">Target Field</span>
                </div>

                <div className="mapper-list">
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
                        />
                    ))}
                </div>

                {missingFields.length > 0 && (
                    <div className="missing-fields-section">
                        <div className="missing-fields-header">
                            <span>Fields not in CSV</span>
                            <span className="missing-fields-count">{missingFields.length}</span>
                        </div>
                        <div className="missing-fields-list">
                            {missingFields.map(item => (
                                <div key={item.field.id} className="missing-field-row">
                                    <div className="missing-field-info">
                                        <span className="field-name">{item.field.name}</span>
                                        <span className="field-type">{labelByFieldType[item.field.type]}</span>
                                    </div>
                                    <select
                                        className="missing-field-action"
                                        value={item.action}
                                        onChange={e => {
                                            updateMissingFieldAction(
                                                item.field.id,
                                                e.target.value as MissingFieldAction
                                            )
                                        }}
                                    >
                                        <option value="ignore">Keep field</option>
                                        <option value="remove">Remove field</option>
                                    </select>
                                </div>
                            ))}
                        </div>
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
                    <hr className="sticky-top" />
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
