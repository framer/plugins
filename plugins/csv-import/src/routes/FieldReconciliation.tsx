import type { Collection, Field } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"
import type { InferredField } from "../utils/typeInference"

const labelByFieldTypeOption: Record<Field["type"], string> = {
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

export type FieldAction = "add" | "update" | "keep" | "remove" | "map"

export interface FieldReconciliationItem {
    inferredField?: InferredField
    existingField?: Field
    action: FieldAction
    // For mapping: which existing field this CSV column should map to
    mapToFieldId?: string
}

interface FieldReconciliationProps {
    collection: Collection
    inferredFields: InferredField[]
    csvRecords: Record<string, string>[]
    onSubmit: (reconciliation: FieldReconciliationItem[]) => Promise<void>
    onCancel: () => Promise<void>
}

export function FieldReconciliation({ collection, inferredFields, onSubmit, onCancel }: FieldReconciliationProps) {
    const isAllowedToManage = useIsAllowedTo("Collection.addItems")
    const [existingFields, setExistingFields] = useState<Field[]>([])
    const [reconciliationItems, setReconciliationItems] = useState<FieldReconciliationItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadFields() {
            try {
                const fields = await collection.getFields()
                setExistingFields(fields)

                // Create initial reconciliation items
                const items: FieldReconciliationItem[] = []

                // Add items for inferred fields
                for (const inferredField of inferredFields) {
                    const existingField = fields.find(f => f.name.toLowerCase() === inferredField.name.toLowerCase())

                    if (existingField) {
                        // Field exists - check if types match
                        if (existingField.type === inferredField.inferredType) {
                            items.push({
                                inferredField,
                                existingField,
                                action: "keep",
                            })
                        } else {
                            // Type mismatch - suggest updating the field type
                            items.push({
                                inferredField,
                                existingField,
                                action: "update",
                                mapToFieldId: existingField.id,
                            })
                        }
                    } else {
                        // New field
                        items.push({
                            inferredField,
                            action: "add",
                        })
                    }
                }

                // Add items for existing fields not in CSV
                for (const existingField of fields) {
                    const hasInferredField = inferredFields.some(
                        f => f.name.toLowerCase() === existingField.name.toLowerCase()
                    )
                    if (!hasInferredField) {
                        items.push({
                            existingField,
                            action: "keep",
                        })
                    }
                }

                setReconciliationItems(items)
            } catch (error) {
                console.error("Error loading fields:", error)
                framer.notify("Error loading collection fields", { variant: "error" })
            } finally {
                setLoading(false)
            }
        }

        void loadFields()
    }, [collection, inferredFields])

    const updateAction = useCallback((index: number, action: FieldAction, mapToFieldId?: string) => {
        setReconciliationItems(prev =>
            prev.map((item, i) => {
                if (i === index) {
                    return { ...item, action, mapToFieldId }
                }
                return item
            })
        )
    }, [])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        await onSubmit(reconciliationItems)
    }

    if (loading) {
        return (
            <main className="framer-hide-scrollbar reconciliation">
                <div className="loading">Loading fields...</div>
            </main>
        )
    }

    const newFields = reconciliationItems.filter(item => item.action === "add")
    const mappedFields = reconciliationItems.filter(item => item.action === "map")
    // Include both "update" and "keep" actions if there's a type mismatch
    const updatedFields = reconciliationItems.filter(
        item =>
            (item.action === "update" || item.action === "keep") &&
            item.inferredField &&
            item.existingField &&
            item.existingField.type !== item.inferredField.inferredType
    )

    return (
        <main className="framer-hide-scrollbar reconciliation">
            <hr className="sticky-divider" />
            <form onSubmit={e => void handleSubmit(e)}>
                <div className="reconciliation-content">
                    <div className="reconciliation-header">
                        <h3>Review Field Changes</h3>
                        <p className="reconciliation-description">
                            Review how CSV columns will be mapped to collection fields
                        </p>
                    </div>

                    {newFields.length > 0 && (
                        <div className="reconciliation-section">
                            <h4 className="section-title">New Fields ({newFields.length})</h4>
                            <div className="field-list">
                                {reconciliationItems.map((item, index) => {
                                    if (item.action !== "add" || !item.inferredField) return null
                                    return (
                                        <div key={index} className="field-item new-field">
                                            <div className="field-info">
                                                <span className="field-name">{item.inferredField.name}</span>
                                                <span className="field-type">
                                                    {labelByFieldTypeOption[item.inferredField.inferredType]}
                                                </span>
                                            </div>
                                            <div className="field-actions">
                                                <button
                                                    type="button"
                                                    className="action-button secondary"
                                                    onClick={() => updateAction(index, "map")}
                                                    disabled={!isAllowedToManage}
                                                >
                                                    Map to existing
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {updatedFields.length > 0 && (
                        <div className="reconciliation-section">
                            <h4 className="section-title">Fields with Type Changes ({updatedFields.length})</h4>
                            <div className="field-list">
                                {reconciliationItems.map((item, index) => {
                                    // Show if action is "update" or "keep" AND there's a type mismatch
                                    if (
                                        (item.action !== "update" && item.action !== "keep") ||
                                        !item.inferredField ||
                                        !item.existingField ||
                                        item.existingField.type === item.inferredField.inferredType
                                    )
                                        return null

                                    return (
                                        <div key={index} className="field-item updated-field">
                                            <div className="field-info">
                                                <span className="field-name">{item.existingField.name}</span>
                                                <div className="type-change">
                                                    <span className="field-type old-type">
                                                        {labelByFieldTypeOption[item.existingField.type]}
                                                    </span>
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        fill="none"
                                                        viewBox="0 0 16 16"
                                                    >
                                                        <path
                                                            fill="currentColor"
                                                            d="M5 8l3-3 3 3"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            transform="rotate(90 8 8)"
                                                        />
                                                    </svg>
                                                    <span className="field-type new-type">
                                                        {labelByFieldTypeOption[item.inferredField.inferredType]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="field-actions-full">
                                                <select
                                                    className="action-select"
                                                    value={item.action}
                                                    onChange={e => {
                                                        const action = e.target.value as FieldAction
                                                        updateAction(index, action)
                                                    }}
                                                    disabled={!isAllowedToManage}
                                                >
                                                    <option value="update">
                                                        Change field type to{" "}
                                                        {labelByFieldTypeOption[item.inferredField.inferredType]}
                                                    </option>
                                                    <option value="keep">
                                                        Keep type and ignore incompatible values
                                                    </option>
                                                </select>
                                                <button
                                                    type="button"
                                                    className="action-button secondary"
                                                    onClick={() => updateAction(index, "map")}
                                                    disabled={!isAllowedToManage}
                                                >
                                                    Map to different field
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {mappedFields.length > 0 && (
                        <div className="reconciliation-section">
                            <h4 className="section-title">Mapped Fields ({mappedFields.length})</h4>
                            <div className="field-list">
                                {reconciliationItems.map((item, index) => {
                                    if (item.action !== "map" || !item.inferredField) return null
                                    const mappedField = item.mapToFieldId
                                        ? existingFields.find(f => f.id === item.mapToFieldId)
                                        : item.existingField

                                    return (
                                        <div key={index} className="field-item mapped-field">
                                            <div className="field-mapping">
                                                <div className="field-info">
                                                    <span className="field-name">{item.inferredField.columnName}</span>
                                                    <span className="field-type">
                                                        {labelByFieldTypeOption[item.inferredField.inferredType]}
                                                    </span>
                                                </div>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="16"
                                                    height="16"
                                                    fill="none"
                                                    viewBox="0 0 16 16"
                                                >
                                                    <path
                                                        fill="currentColor"
                                                        d="M5 8l3-3 3 3"
                                                        stroke="currentColor"
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        transform="rotate(90 8 8)"
                                                    />
                                                </svg>
                                                <select
                                                    className="field-select"
                                                    value={item.mapToFieldId || ""}
                                                    onChange={e => updateAction(index, "map", e.target.value)}
                                                    disabled={!isAllowedToManage}
                                                >
                                                    {existingFields.map(field => (
                                                        <option key={field.id} value={field.id}>
                                                            {field.name} ({labelByFieldTypeOption[field.type]})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="field-actions">
                                                <button
                                                    type="button"
                                                    className="action-button secondary"
                                                    onClick={() => updateAction(index, "add")}
                                                    disabled={!isAllowedToManage}
                                                >
                                                    Create new instead
                                                </button>
                                            </div>
                                            {mappedField && mappedField.type !== item.inferredField.inferredType && (
                                                <div className="field-warning">
                                                    ⚠️ Type mismatch: CSV has{" "}
                                                    {labelByFieldTypeOption[item.inferredField.inferredType]}, field is{" "}
                                                    {labelByFieldTypeOption[mappedField.type]}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {reconciliationItems.some(item => item.existingField && !item.inferredField) && (
                        <div className="reconciliation-section">
                            <h4 className="section-title">Existing Fields Not in CSV</h4>
                            <div className="field-list">
                                {reconciliationItems.map((item, index) => {
                                    if (!item.existingField || item.inferredField) return null
                                    return (
                                        <div key={index} className="field-item existing-field">
                                            <div className="field-info">
                                                <span className="field-name">{item.existingField.name}</span>
                                                <span className="field-type">
                                                    {labelByFieldTypeOption[item.existingField.type]}
                                                </span>
                                            </div>
                                            <div className="field-actions">
                                                <select
                                                    className="action-select"
                                                    value={item.action}
                                                    onChange={e => updateAction(index, e.target.value as FieldAction)}
                                                    disabled={!isAllowedToManage}
                                                >
                                                    <option value="keep">Keep (set empty)</option>
                                                    <option value="remove">Remove field</option>
                                                </select>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <footer>
                    <hr className="sticky-top" />
                    <div className="actions">
                        <button type="button" onClick={() => void onCancel()} disabled={!isAllowedToManage}>
                            Back
                        </button>
                        <button
                            type="submit"
                            className="framer-button-primary"
                            disabled={!isAllowedToManage}
                            title={!isAllowedToManage ? "Insufficient permissions" : undefined}
                        >
                            Continue to Import
                        </button>
                    </div>
                </footer>
            </form>
        </main>
    )
}
