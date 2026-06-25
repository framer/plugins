import type { Collection, Field } from "framer-plugin"
import { framer } from "framer-plugin"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronIcon } from "../components/ChevronIcon"
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
    /**
     * When false, the user can only map CSV columns onto existing fields. Creating new
     * fields and removing existing fields is disabled (e.g. content-editing-only permissions).
     */
    canEditFields: boolean
    onSubmit: (opts: FieldMapperSubmitOpts) => Promise<void>
}

function isValidSlugColumn(columnName: string, csvRecords: Record<string, string>[]) {
    return csvRecords.every(record => record[columnName])
}

function calculatePossibleSlugFields(mappings: FieldMappingItem[], csvRecords: Record<string, string>[]) {
    return mappings.filter(m => isValidSlugColumn(m.inferredField.columnName, csvRecords)).map(m => m.inferredField)
}

const caseInsensitiveEquals = (a: string | undefined | null, b: string | undefined | null) =>
    a?.toLocaleLowerCase() === b?.toLocaleLowerCase()

/**
 * Determine how a column should be restored when it is un-ignored. With field-editing
 * permissions it becomes a new field. Without them the user can only map onto existing
 * fields, so we pick the first unmapped existing field (or keep it ignored if none remain).
 */
function buildUnignoreUpdate(
    item: FieldMappingItem,
    canEditFields: boolean,
    existingFields: Field[],
    allMappings: FieldMappingItem[]
): Partial<FieldMappingItem> {
    if (canEditFields) {
        return { action: "create", targetFieldId: undefined, hasTypeMismatch: false }
    }

    const usedFieldIds = new Set(
        allMappings
            .filter(
                m =>
                    m.action === "map" &&
                    m.targetFieldId &&
                    m.inferredField.columnName !== item.inferredField.columnName
            )
            .map(m => m.targetFieldId)
    )
    const target = existingFields.find(field => !usedFieldIds.has(field.id))
    if (!target) {
        return { action: "ignore", targetFieldId: undefined, hasTypeMismatch: false }
    }

    const targetVirtualType = sdkTypeToVirtual(target)
    const hasTypeMismatch = targetVirtualType
        ? !isTypeCompatible(item.inferredField.inferredType, targetVirtualType)
        : false

    return { action: "map", targetFieldId: target.id, hasTypeMismatch }
}

export function FieldMapper({ collection, csvRecords, canEditFields, onSubmit }: FieldMapperProps) {
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
                    ? inferredFields.find(field => caseInsensitiveEquals(field.columnName, collection.slugFieldName))
                          ?.columnName
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

                    // No match - create a new field, or ignore it when it's the slug field
                    // or when the user isn't allowed to create fields (they can only map
                    // onto existing fields, so unmatched columns stay unmapped).
                    return {
                        inferredField,
                        action: isSlugField || !canEditFields ? "ignore" : "create",
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
    }, [collection, csvRecords, canEditFields])

    // Keep the "Unmapped CMS Fields" list in sync with the current mappings, preserving any
    // action the user already chose for a field that remains unmapped.
    const recomputeMissingFields = useCallback(
        (newMappings: FieldMappingItem[]) => {
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
        },
        [existingFields]
    )

    const toggleIgnored = useCallback(
        (columnName: string) => {
            setMappings(prev => {
                const newMappings = prev.map(item => {
                    if (item.inferredField.columnName !== columnName) return item

                    if (item.action === "ignore") {
                        return { ...item, ...buildUnignoreUpdate(item, canEditFields, existingFields, prev) }
                    }
                    return { ...item, action: "ignore" as const, targetFieldId: undefined, hasTypeMismatch: false }
                })

                recomputeMissingFields(newMappings)
                return newMappings
            })
        },
        [canEditFields, existingFields, recomputeMissingFields]
    )

    const setIgnored = useCallback(
        (columnName: string, ignored: boolean) => {
            setMappings(prev => {
                const newMappings = prev.map(item => {
                    if (item.inferredField.columnName !== columnName) return item

                    if (ignored) {
                        return { ...item, action: "ignore" as const, targetFieldId: undefined, hasTypeMismatch: false }
                    } else if (item.action === "ignore") {
                        return { ...item, ...buildUnignoreUpdate(item, canEditFields, existingFields, prev) }
                    }
                    return item
                })

                recomputeMissingFields(newMappings)
                return newMappings
            })
        },
        [canEditFields, existingFields, recomputeMissingFields]
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

                recomputeMissingFields(newMappings)
                return newMappings
            })
        },
        [existingFields, recomputeMissingFields]
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

        if (requiredFieldIssues.length > 0) {
            return
        }

        await onSubmit({ mappings, slugFieldName: selectedSlugFieldName, missingFields })
    }

    const requiredFieldIssues = useMemo(() => {
        return existingFields
            .filter(field => "required" in field && field.required)
            .map(field => {
                const mapping = mappings.find(m => m.action === "map" && m.targetFieldId === field.id)

                if (!mapping) {
                    return { field, issue: "unmapped" as const }
                }

                const columnName = mapping.inferredField.columnName
                const hasEmptyValues = csvRecords.some(record => {
                    const value = record[columnName]
                    return value === undefined || value.trim() === ""
                })

                if (hasEmptyValues) {
                    return { field, issue: "partial" as const }
                }

                return undefined
            })
            .filter(issue => issue !== undefined)
    }, [existingFields, mappings, csvRecords])

    const canSubmit = requiredFieldIssues.length === 0 && !!selectedSlugFieldName

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
                            canEditFields={canEditFields}
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
                                <ChevronIcon />
                                <select
                                    className="missing-field-action"
                                    disabled={!canEditFields}
                                    value={item.action}
                                    onChange={e => {
                                        updateMissingFieldAction(item.field.id, e.target.value as MissingFieldAction)
                                    }}
                                >
                                    <option value="ignore">Keep Empty</option>
                                    {canEditFields && <option value="remove">Remove</option>}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {requiredFieldIssues.length > 0 && (
                    <div className="required-fields-section">
                        <div className="required-fields-header">
                            <span className="subheading">Required Fields</span>
                        </div>
                        {requiredFieldIssues.map(({ field, issue }) => (
                            <div key={field.id} className="required-field-row">
                                <div className="required-field-info">
                                    <span className="field-name">{field.name}</span>
                                    <span className="field-type">{labelByFieldType[field.type]}</span>
                                </div>
                                <ChevronIcon />
                                <span className="required-field-warning">
                                    {issue === "unmapped"
                                        ? "Field is required but is missing"
                                        : "Field is required but some values are missing"}
                                </span>
                            </div>
                        ))}
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
                    <button type="submit" className="framer-button-primary" disabled={!canSubmit}>
                        Import
                    </button>
                </footer>
            </form>
        </main>
    )
}
