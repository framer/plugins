import { ManagedCollectionField, framer } from "framer-plugin"
import { useState, useMemo, useLayoutEffect } from "react"
import { Fragment } from "react/jsx-runtime"
import {
    SupportedCollectionFieldTypeWithoutReference,
    DataSource,
    FieldConfig,
    computeFieldConfig,
    DataSourceFieldType,
    FIELD_MAPPING,
    COLLECTIONS_SYNC_MAP,
} from "./data"
import { assert } from "./utils"

const TYPE_NAMES: Record<SupportedCollectionFieldTypeWithoutReference, string> = {
    string: "String",
    date: "Date",
    image: "Image",
    link: "Link",
    file: "File",
    number: "Number",
    boolean: "Boolean",
    enum: "Option",
    color: "Color",
    formattedText: "Formatted Text",
}

interface FieldMappingRowProps {
    field: FieldConfig
    isIgnored: boolean
    onFieldToggle: (fieldId: string) => void
    onFieldNameChange: (fieldId: string, name: string) => void
    onFieldTypeChange: (id: string, type: DataSourceFieldType) => void
}

function FieldMappingRow({
    field,
    isIgnored,
    onFieldToggle,
    onFieldNameChange,
    onFieldTypeChange,
}: FieldMappingRowProps) {
    const { isUnsupported, isDisabled, placeholder, selectedType, fieldName } = useMemo(() => {
        const isUnsupported = !field.field
        const isMissingReference = !isUnsupported && field.reference?.destination === null
        const isDisabled = isUnsupported || isMissingReference || isIgnored

        let placeholder = field.source.name
        if (isMissingReference) {
            placeholder = "Missing Reference"
        } else if (isUnsupported) {
            placeholder = "Unsupported Field"
        }

        const selectedType =
            field.reference && field.field?.type === "string"
                ? "string"
                : field.reference?.destination || field.field!.type

        const hasFieldNameChanged = field.field?.name !== field.source.name
        const fieldName = hasFieldNameChanged ? field.field?.name : ""

        return {
            isUnsupported,
            isDisabled,
            placeholder,
            selectedType,
            fieldName,
        }
    }, [field, isIgnored])

    return (
        <Fragment>
            <div
                className="column-row"
                aria-disabled={isDisabled}
                onClick={() => onFieldToggle(field.field!.id)}
                role="button"
            >
                <input type="checkbox" disabled={isUnsupported} checked={!isDisabled} />
                <span>{field.source.name}</span>
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
                    assert(field.field)
                    if (!e.target.value.trim()) {
                        onFieldNameChange(field.field.id, field.source.name)
                    } else {
                        onFieldNameChange(field.field.id, e.target.value)
                    }
                }}
            />
            <select
                style={{
                    width: "100%",
                    opacity: isDisabled ? 0.5 : 1,
                    textTransform: "capitalize",
                }}
                disabled={isDisabled}
                value={isUnsupported ? "Unsupported Field" : selectedType}
                onChange={e => {
                    assert(field.field)
                    onFieldTypeChange(field.field.id, e.target.value as DataSourceFieldType)
                }}
            >
                {field.field && (
                    <>
                        <option value="string">String</option>
                        {field.reference ? (
                            <>
                                <hr />
                                {COLLECTIONS_SYNC_MAP.get(field.reference.source)?.map(({ id, name }) => (
                                    <option key={id} value={id}>
                                        {name}
                                    </option>
                                ))}
                            </>
                        ) : (
                            FIELD_MAPPING[field.source.type].map(type => (
                                <option key={`${field.source.name}-${type}`} value={type}>
                                    {TYPE_NAMES[type]}
                                </option>
                            ))
                        )}
                    </>
                )}
            </select>
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
        savedFieldsConfig ?? computeFieldConfig(existingFields, dataSource)
    )
    const [disabledFieldIds, setDisabledFieldIds] = useState<Set<string>>(
        new Set(savedFieldsConfig?.filter(field => field.source.ignored).map(field => field.field!.id))
    )

    const slugFields = useMemo(
        () =>
            fields.filter(
                field => field.field && !disabledFieldIds.has(field.field.id) && field.field.type === "string"
            ),
        [fields, disabledFieldIds]
    )
    const [slugFieldId, setSlugFieldId] = useState<string | null>(savedSlugFieldId ?? slugFields[0]?.field?.id ?? null)

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
                    const nextSlugField = slugFields.find(field => field.field?.id !== fieldId)
                    if (nextSlugField?.field && !nextSet.has(nextSlugField.field.id)) {
                        setSlugFieldId(nextSlugField.field.id)
                    }
                }
            }
            return nextSet
        })
    }

    const handleFieldTypeChange = (id: string, type: DataSourceFieldType) => {
        setFields(current =>
            current.map(field => {
                if (field.field?.id !== id) {
                    return field
                }
                // If this is a reference field and we're changing to a string type,
                // preserve the reference information but clear the destination
                if (field.reference && type === "string") {
                    return {
                        ...field,
                        field: {
                            id: field.field?.id,
                            type: "string",
                            name: field.field?.name,
                            userEditable: false,
                        } as ManagedCollectionField,
                    }
                }

                // If this is a reference field and we're changing to a collection reference,
                // use the original reference type and set the destination to the new type
                if (field.reference && type !== "string") {
                    return {
                        ...field,
                        reference: {
                            ...field.reference,
                            destination: type,
                        },
                        field: {
                            id: field.field?.id,
                            type: field.reference.type,
                            name: field.field?.name,
                            collectionId: type,
                            userEditable: false,
                        } as ManagedCollectionField,
                    }
                }

                // Default case - just update the type
                return { ...field, field: { ...field.field, type } as ManagedCollectionField }
            })
        )
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        assert(slugFieldId, "Slug field is required")

        try {
            setIsSyncing(true)
            await onSubmit(
                dataSource,
                fields
                    .filter(field => field.field && !disabledFieldIds.has(field.field!.id))
                    .filter(field => !field.reference || field.reference.destination !== null),
                slugFieldId
            )
        } catch (error) {
            framer.notify(`Failed to sync collection ${dataSource.id}`, {
                variant: "error",
            })
            console.error(error)
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
        <main className="field-mapping-container no-scrollbar">
            <form className="field-mapping-form" onSubmit={handleSubmit}>
                <hr className="divider sticky-top" />
                <label className="field-slug-label" htmlFor="slugField">
                    Slug Field
                    <select
                        name="slugField"
                        className="field-input"
                        value={slugFieldId ?? ""}
                        onChange={e => setSlugFieldId(e.target.value)}
                        required
                    >
                        {slugFields.map(field => {
                            assert(field.field)
                            return (
                                <option key={field.field.id} value={field.field.id}>
                                    {field.field.name}
                                </option>
                            )
                        })}
                    </select>
                </label>
                <div className="field-grid">
                    <span className="column-span-2">Column</span>
                    <span>Field</span>
                    <span>Type</span>

                    {fields.map((field, i) => (
                        <FieldMappingRow
                            key={field.field?.id || i}
                            field={field}
                            isIgnored={disabledFieldIds.has(field.field?.id ?? "")}
                            onFieldToggle={handleFieldToggle}
                            onFieldNameChange={handleFieldNameChange}
                            onFieldTypeChange={handleFieldTypeChange}
                        />
                    ))}
                </div>
                <div className="sticky-footer">
                    <hr className="divider" />
                    <button className="framer-button-primary" disabled={isSyncing}>
                        Import <span style={{ textTransform: "capitalize" }}>{dataSource.id}</span>
                    </button>
                </div>
            </form>
        </main>
    )
}
