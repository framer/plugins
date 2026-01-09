import type { Field } from "framer-plugin"
import { labelByFieldType } from "../utils/fieldLabels"
import type { InferredField } from "../utils/typeInference"

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

interface FieldMapperRowProps {
    item: FieldMappingItem
    existingFields: Field[]
    onToggleIgnored: () => void
    onSetIgnored: (ignored: boolean) => void
    onTargetChange: (targetFieldId: string | null) => void
    onTypeChange: (type: Field["type"]) => void
}

export function FieldMapperRow({
    item,
    existingFields,
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
                className={`source-field ${isIgnored ? "ignored" : ""}`}
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
                <option value="__create__">New Field...</option>
                {isIgnored && <option value="__ignore__"></option>}

                {existingFields.length > 0 && <hr />}
                {existingFields.map(field => (
                    <option key={field.id} value={field.id}>
                        {field.name}
                    </option>
                ))}
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
