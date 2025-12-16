import type { Field } from "framer-plugin"
import { framer, useIsAllowedTo } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import type { InferredField } from "./typeInference"

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

interface FieldMappingRowProps {
    field: InferredField
    ignored: boolean
    isAllowedToManage: boolean
    onToggleIgnored: (fieldName: string) => void
    onNameChange: (fieldName: string, name: string) => void
    onFieldTypeChange: (fieldName: string, type: Field["type"]) => void
}

function FieldMappingRow({
    field,
    ignored,
    isAllowedToManage,
    onToggleIgnored,
    onNameChange,
    onFieldTypeChange,
}: FieldMappingRowProps) {
    const { originalName, name, inferredType, allowedTypes } = field
    const disabled = ignored || !isAllowedToManage

    return (
        <>
            <button
                type="button"
                className="source-field"
                aria-disabled={disabled}
                onClick={() => {
                    onToggleIgnored(originalName)
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
            <select
                className="field-type"
                disabled={disabled || allowedTypes.length <= 1}
                value={inferredType}
                onChange={event => {
                    const value = allowedTypes.find(type => type === event.target.value)
                    if (value) {
                        onFieldTypeChange(originalName, value)
                    }
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
                    onNameChange(originalName, event.target.value)
                }}
                onKeyDown={event => {
                    if (event.key === "Enter") {
                        event.preventDefault()
                    }
                }}
                className="field-input"
            />
        </>
    )
}

interface FieldMappingProps {
    inferredFields: InferredField[]
    csvRecords: Record<string, string>[]
    onSubmit: (fields: InferredField[], ignoredFieldNames: Set<string>, slugFieldName: string) => Promise<void>
    onCancel: () => Promise<void>
}

export function FieldMapping({ inferredFields, csvRecords, onSubmit, onCancel }: FieldMappingProps) {
    const isAllowedToManage = useIsAllowedTo("Collection.addItems")

    const [fields, setFields] = useState<InferredField[]>(inferredFields)
    const [ignoredFieldNames, setIgnoredFieldNames] = useState<Set<string>>(new Set())
    const [selectedSlugFieldName, setSelectedSlugFieldName] = useState<string | null>(null)

    // Determine possible slug fields (string or formattedText types)
    const possibleSlugFields = useMemo(() => {
        return fields.filter(field => field.inferredType === "string" || field.inferredType === "formattedText")
    }, [fields])

    useEffect(() => {
        // Auto-select first possible slug field
        if (possibleSlugFields.length > 0 && !selectedSlugFieldName) {
            setSelectedSlugFieldName(possibleSlugFields[0]?.originalName ?? null)
        }
    }, [possibleSlugFields, selectedSlugFieldName])

    const changeFieldName = (originalName: string, name: string) => {
        setFields(prevFields =>
            prevFields.map(field => (field.originalName === originalName ? { ...field, name } : field))
        )
    }

    const changeFieldType = (originalName: string, type: Field["type"]) => {
        setFields(prevFields =>
            prevFields.map(field =>
                field.originalName === originalName && field.allowedTypes.includes(type)
                    ? { ...field, inferredType: type }
                    : field
            )
        )
    }

    const toggleFieldIgnoredState = (fieldName: string) => {
        setIgnoredFieldNames(prevIgnored => {
            const updated = new Set(prevIgnored)
            if (updated.has(fieldName)) {
                updated.delete(fieldName)
            } else {
                updated.add(fieldName)
            }
            return updated
        })
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!selectedSlugFieldName) {
            framer.notify("Please select a slug field before importing.", { variant: "warning" })
            return
        }

        await onSubmit(fields, ignoredFieldNames, selectedSlugFieldName)
    }

    return (
        <main className="framer-hide-scrollbar mapping">
            <hr className="sticky-divider" />
            <form onSubmit={e => void handleSubmit(e)}>
                <label className="slug-field" htmlFor="slugField">
                    <span>Slug Field</span>
                    <select
                        required
                        name="slugField"
                        className="field-input"
                        value={selectedSlugFieldName ?? ""}
                        disabled={!isAllowedToManage}
                        onChange={event => {
                            setSelectedSlugFieldName(event.target.value)
                        }}
                    >
                        {possibleSlugFields.map(field => (
                            <option key={`slug-field-${field.originalName}`} value={field.originalName}>
                                {field.name || field.originalName}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="fields">
                    <span className="fields-column">CSV Column</span>
                    <span>Type</span>
                    <span>Name</span>
                    {fields.map(field => (
                        <FieldMappingRow
                            key={`field-${field.originalName}`}
                            field={field}
                            ignored={ignoredFieldNames.has(field.originalName)}
                            isAllowedToManage={isAllowedToManage}
                            onToggleIgnored={toggleFieldIgnoredState}
                            onNameChange={changeFieldName}
                            onFieldTypeChange={changeFieldType}
                        />
                    ))}
                </div>

                <footer>
                    <hr className="sticky-top" />
                    <div className="actions">
                        <button type="button" onClick={() => void onCancel()} disabled={!isAllowedToManage}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="framer-button-primary"
                            disabled={!isAllowedToManage}
                            title={!isAllowedToManage ? "Insufficient permissions" : undefined}
                        >
                            Import {csvRecords.length} {csvRecords.length === 1 ? "item" : "items"}
                        </button>
                    </div>
                </footer>
            </form>
        </main>
    )
}
