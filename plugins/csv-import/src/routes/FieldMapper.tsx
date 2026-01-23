import type { Collection, Field } from "framer-plugin"
import { framer } from "framer-plugin"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FieldMapperRow, type FieldMappingItem } from "../components/FieldMapperRow"
import { labelByFieldType } from "../utils/fieldLabels"
import { getDataFields } from "../utils/filterFields"
import { isTypeCompatible } from "../utils/typeCompatibility"
import { inferFieldsFromCSV } from "../utils/typeInference"
import type { VirtualFieldType } from "../utils/virtualTypes"
import { sdkTypeToVirtual } from "../utils/virtualTypes"

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
}

function isValidSlugColumn(columnName: string, csvRecords: Record<string, string>[]) {
    return csvRecords.every(record => record[columnName])
}

function calculatePossibleSlugFields(mappings: FieldMappingItem[], csvRecords: Record<string, string>[]) {
    return mappings.filter(m => isValidSlugColumn(m.inferredField.columnName, csvRecords)).map(m => m.inferredField)
}

export function FieldMapper({ collection, csvRecords, onSubmit }: FieldMapperProps) {
    const [existingFields, setExistingFields] = useState<Field[]>([])
    const [mappings, setMappings] = useState<FieldMappingItem[]>([])
    const possibleSlugFields = useMemo(() => calculatePossibleSlugFields(mappings, csvRecords), [csvRecords, mappings])

    const [missingFields, setMissingFields] = useState<MissingFieldItem[]>([])
    const [selectedSlugFieldName, setSelectedSlugFieldName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Load existing fields and create initial mappings
    useEffect(() => {
        async function loadFields() {
            try {
                const allFields = await collection.getFields()
                const fields = getDataFields(allFields)
                setExistingFields(fields)

                const inferredFields = inferFieldsFromCSV(csvRecords)

                // Existing Slug field match against CSV column if any
                const matchedSlugColumnName = collection.slugFieldName
                    ? inferredFields.find(field => field.columnName === collection.slugFieldName)?.columnName
                    : undefined

                // Column we will suggest as slug field on the UI
                const suggestedSlugColumnName =
                    matchedSlugColumnName ??
                    inferredFields.find(field => isValidSlugColumn(field.columnName, csvRecords))?.columnName

                // Create initial mappings based on name matching
                const initialMappings: FieldMappingItem[] = inferredFields.map(inferredField => {
                    // ignore slug field if it matches the collection's slugFieldName
                    // If it was auto-detected, keep it enabled
                    const isSlugField = matchedSlugColumnName
                        ? inferredField.columnName === matchedSlugColumnName
                        : false

                    // Try to find an existing field with matching name
                    const matchingField = fields.find(f => f.name.toLowerCase() === inferredField.name.toLowerCase())
                    if (matchingField) {
                        const hasTypeMismatch = !isTypeCompatible(inferredField.inferredType, matchingField.type)

                        return {
                            inferredField,
                            action: isSlugField ? "ignore" : "map",
                            targetFieldId: isSlugField ? undefined : matchingField.id,
                            hasTypeMismatch: isSlugField ? false : hasTypeMismatch,
                        }
                    }

                    // No match - create new field or ignore if it's the slug field
                    return {
                        inferredField,
                        action: isSlugField ? "ignore" : "create",
                        hasTypeMismatch: false,
                    }
                })

                const mappedFieldIds = new Set<string>(
                    initialMappings.filter(m => m.action === "map" && m.targetFieldId).map(m => m.targetFieldId ?? "")
                )

                setMappings(initialMappings)
                setSelectedSlugFieldName(suggestedSlugColumnName ?? null)

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

    const toggleIgnored = useCallback((columnName: string) => {
        setMappings(prev => {
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

            return newMappings
        })
    }, [])

    const setIgnored = useCallback((columnName: string, ignored: boolean) => {
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

            return newMappings
        })
    }, [])

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
                    const targetVirtualType = targetField ? sdkTypeToVirtual(targetField) : null
                    const hasTypeMismatch =
                        targetField && targetVirtualType
                            ? !isTypeCompatible(item.inferredField.inferredType, targetVirtualType)
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

    const updateType = useCallback((columnName: string, type: VirtualFieldType) => {
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
                <label className="slug-field" htmlFor="slugField">
                    <span className="subheading">Slug Field</span>
                    <select
                        required
                        name="slugField"
                        className="slug-field-input"
                        value={selectedSlugFieldName ?? ""}
                        onChange={event => {
                            setSelectedSlugFieldName(event.target.value)
                        }}
                    >
                        {!selectedSlugFieldName && (
                            <option value="" disabled>
                                Select...
                            </option>
                        )}
                        {possibleSlugFields.map(field => (
                            <option key={`slug-field-${field.columnName}`} value={field.columnName}>
                                {field.name || field.columnName}
                            </option>
                        ))}
                    </select>
                </label>

                <span className="subheading negmargin">Columns Mapping</span>
                <div className="fields">
                    <span className="fields-column">CSV Column</span>
                    <span>CMS Field</span>
                    <span>Type</span>
                    {mappings.map(item => (
                        <FieldMapperRow
                            key={item.inferredField.columnName}
                            item={item}
                            existingFields={existingFields}
                            slugFieldName={selectedSlugFieldName}
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
                            <span className="subheading">Unmapped CMS Fields</span>
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
                                    <option value="ignore">Keep Empty</option>
                                    <option value="remove">Remove</option>
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
                    <div className="footer-stats">
                        <span className="summary-stat">
                            <strong>{stats.total}</strong> Columns
                        </span>
                        {stats.matched > 0 && (
                            <span className="summary-stat matched">
                                <strong>{stats.matched}</strong> Matched
                            </span>
                        )}
                        {stats.creating > 0 && (
                            <span className="summary-stat creating">
                                <strong>{stats.creating}</strong> New
                            </span>
                        )}
                        {stats.mismatched > 0 && (
                            <span className="summary-stat mismatched">
                                <strong>{stats.mismatched}</strong> Type Issues
                            </span>
                        )}
                        {stats.ignored > 0 && (
                            <span className="summary-stat ignored">
                                <strong>{stats.ignored}</strong> Ignored
                            </span>
                        )}
                        <span className="summary-divider">|</span>
                        <span className="summary-stat">
                            <strong>{csvRecords.length}</strong> Items
                        </span>
                    </div>
                    <button
                        type="submit"
                        className="framer-button-primary"
                        disabled={!canSubmit}
                        title={unmappedRequiredFields.length > 0 ? "Map all required fields to continue" : undefined}
                    >
                        Import
                    </button>
                </footer>
            </form>
        </main>
    )
}
