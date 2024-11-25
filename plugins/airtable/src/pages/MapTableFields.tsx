import { Fragment, useEffect, useMemo, useState } from "react"
import { ManagedCollectionField } from "framer-plugin"
import { useInView } from "react-intersection-observer"
import cx from "classnames"
import { assert, isDefined } from "../utils"
import { AirtableFieldSchema, AirtableTableSchema } from "../api"
import {
    getCollectionForAirtableField,
    PluginContext,
    PluginContextNew,
    PluginContextUpdate,
    SyncMutationOptions,
    SyncProgress,
} from "../airtable"

import { Button } from "../components/Button"
import { IconChevron } from "../components/Icons"
import { CheckboxTextfield } from "@/components/CheckboxTextField"

interface ManagedCollectionFieldConfig {
    field: ManagedCollectionField | null
    originalFieldName: string
}

const sortField = (fieldA: ManagedCollectionFieldConfig, fieldB: ManagedCollectionFieldConfig): number => {
    if (fieldA.field && !fieldB.field) return -1
    if (!fieldA.field && fieldB.field) return 1
    return 0
}

const getInitialSlugFieldId = (context: PluginContext, primaryFieldId: string): string | null => {
    if (context.type === "update" && context.slugFieldId) return context.slugFieldId

    return primaryFieldId
}

const getLastSyncedTime = (
    pluginContext: PluginContextUpdate | PluginContextNew,
    slugFieldId: string
): string | null => {
    if (pluginContext.type !== "update") return null

    // Always resync if the slug field changes.
    if (pluginContext.slugFieldId !== slugFieldId) return null

    // Always resync if field config changes.
    if (pluginContext.hasChangedFields) {
        return null
    }

    return pluginContext.lastSyncedTime
}

const createFieldConfig = (
    primaryFieldId: string,
    fieldSchemas: AirtableFieldSchema[],
    tableMapId: Map<string, string>
): ManagedCollectionFieldConfig[] => {
    const result: ManagedCollectionFieldConfig[] = []

    for (const fieldSchema of fieldSchemas) {
        result.push({
            field: getCollectionForAirtableField(fieldSchema, tableMapId),
            originalFieldName: fieldSchema.name,
        })
    }

    const fields = result.sort(sortField)
    const primaryField = fields.find(fieldConfig => fieldConfig.field?.id === primaryFieldId)

    assert(primaryField)

    const sortedFields = result.filter(fieldConfig => fieldConfig.field?.id !== primaryFieldId).sort(sortField)

    return [primaryField, ...sortedFields]
}

const getFieldNameOverrides = (pluginContext: PluginContext): Record<string, string> => {
    const result: Record<string, string> = {}
    if (pluginContext.type !== "update") return result

    for (const field of pluginContext.collectionFields) {
        result[field.id] = field.name
    }

    return result
}

const getPossibleSlugFields = (fieldConfig: ManagedCollectionFieldConfig[]): ManagedCollectionField[] => {
    return fieldConfig
        .filter(field => field.field?.type === "string")
        .map(field => field.field)
        .filter(isDefined)
}

type CollectionFieldType = ManagedCollectionField["type"]
const fieldTypeOptions: { type: CollectionFieldType; label: string }[] = [
    { type: "boolean", label: "Boolean" },
    { type: "color", label: "Color" },
    { type: "number", label: "Number" },
    { type: "string", label: "String" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "image", label: "Image" },
    { type: "link", label: "Link" },
    { type: "date", label: "Date" },
    { type: "enum", label: "Option" },
    { type: "file", label: "File" },
    { type: "collectionReference", label: "Reference" },
    { type: "multiCollectionReference", label: "Multiple References" },
]

interface Props {
    baseId: string
    tableId: string
    tableSchema: AirtableTableSchema
    pluginContext: PluginContextUpdate | PluginContextNew
    onSubmit: (opts: SyncMutationOptions) => void
    isPending: boolean
    tableMapId: Map<string, string>
}

export function MapTableFieldsPage({ baseId, tableId, pluginContext, onSubmit, isPending, tableSchema }: Props) {
    const { ref: scrollRef, inView: isAtBottom } = useInView({ threshold: 1 })
    const [slugFieldId, setSlugFieldId] = useState<string | null>(() =>
        getInitialSlugFieldId(pluginContext, tableSchema.primaryFieldId)
    )
    const [fieldConfig, setFieldConfig] = useState<ManagedCollectionFieldConfig[]>(() =>
        createFieldConfig(tableSchema.primaryFieldId, tableSchema.fields, pluginContext.tableMapId)
    )
    const [disabledFieldIds, setDisabledFieldIds] = useState(
        () => new Set<string>(pluginContext.type === "update" ? pluginContext.ignoredFieldIds : [])
    )
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(pluginContext)
    )
    const slugFields = useMemo(
        () => getPossibleSlugFields(fieldConfig).filter(field => !disabledFieldIds.has(field.id)),
        [fieldConfig, disabledFieldIds]
    )

    // TODO: Render progress in UI
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, setProgress] = useState<SyncProgress | null>(null)

    const handleFieldToggle = (key: string) => {
        setDisabledFieldIds(current => {
            const nextSet = new Set(current)
            if (nextSet.has(key)) {
                nextSet.delete(key)

                // If we're re-enabling a string field and there's no valid slug field,
                // set this field as the slug field
                const field = fieldConfig.find(config => config.field?.id === key)
                if (field?.field?.type === "string") {
                    const currentSlugField = fieldConfig.find(config => config.field?.id === slugFieldId)
                    if (!currentSlugField || nextSet.has(slugFieldId ?? "")) {
                        setSlugFieldId(key)
                    }
                }
            } else {
                nextSet.add(key)

                // If the disabled field is the slug field, update it to the next
                // possible slug field
                if (key === slugFieldId) {
                    const nextSlugField = getPossibleSlugFields(fieldConfig).find(
                        field => field.id !== key && !nextSet.has(field.id)
                    )
                    if (nextSlugField) {
                        setSlugFieldId(nextSlugField.id)
                    }
                }
            }
            return nextSet
        })
    }

    const handleFieldNameChange = (id: string, value: string) => {
        setFieldNameOverrides(current => ({
            ...current,
            [id]: value,
        }))
    }

    const handleFieldTypeChange = (id: string, type: CollectionFieldType) => {
        setFieldConfig(current =>
            current.map(field => {
                if (field.field?.id === id) {
                    return { ...field, field: { ...field.field, type } as ManagedCollectionField }
                }
                return field
            })
        )
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (isPending) return

        const allFields = fieldConfig
            .filter(fieldConfig => fieldConfig.field && !disabledFieldIds.has(fieldConfig.field.id))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                if (fieldNameOverrides[field.id]) {
                    field.name = fieldNameOverrides[field.id]
                }

                return field
            })

        assert(slugFieldId)
        setProgress(null)

        onSubmit({
            onProgress: setProgress,
            lastSyncedTime: getLastSyncedTime(pluginContext, slugFieldId),
            ignoredFieldIds: Array.from(disabledFieldIds),
            fields: allFields,
            slugFieldId,
            baseId,
            tableId,
            tableSchema,
        })
    }

    useEffect(() => {
        setFieldConfig(createFieldConfig(tableSchema.primaryFieldId, tableSchema.fields, pluginContext.tableMapId))
    }, [pluginContext.tableMapId, tableSchema.fields, tableSchema.primaryFieldId])

    return (
        <form onSubmit={handleSubmit} className="col gap-2 flex-1 text-tertiary">
            <div className="h-px border-b border-divider mb-2 sticky top-0" />
            <div className="flex flex-col gap-4 h-fit">
                <div className="flex flex-col gap-2 w-full">
                    <label htmlFor="collectionName">Slug Field</label>
                    <select
                        className="w-full"
                        value={slugFieldId ?? ""}
                        onChange={e => setSlugFieldId(e.target.value)}
                        required
                    >
                        {slugFields.map(field => (
                            <option key={field.id} value={field.id}>
                                {field.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols items-center grid-cols-fieldPicker gap-2.5 mb-auto overflow-hidden">
                <span className="col-span-2">Column</span>
                <span>Field</span>
                <span>Type</span>
                {fieldConfig.map((fieldConfig, i) => {
                    const isUnsupported = !fieldConfig.field
                    const isDisabled = isUnsupported || disabledFieldIds.has(fieldConfig.field!.id)

                    return (
                        <Fragment key={fieldConfig.field!.id || i}>
                            <CheckboxTextfield
                                value={fieldConfig.originalFieldName}
                                disabled={isUnsupported}
                                checked={!isDisabled}
                                onChange={() => {
                                    assert(fieldConfig.field)
                                    handleFieldToggle(fieldConfig.field.id)
                                }}
                            />
                            <div className="flex items-center justify-center">
                                <IconChevron />
                            </div>
                            <input
                                type="text"
                                className={cx("w-full", {
                                    "opacity-50": isDisabled,
                                })}
                                disabled={isDisabled}
                                placeholder={fieldConfig.originalFieldName}
                                value={
                                    isUnsupported
                                        ? "Unsupported Field"
                                        : (fieldNameOverrides[fieldConfig.field!.id] ?? "")
                                }
                                onChange={e => {
                                    assert(fieldConfig.field)
                                    handleFieldNameChange(fieldConfig.field.id, e.target.value)
                                }}
                            />
                            <select
                                className={cx("w-full", {
                                    "opacity-50": isDisabled,
                                })}
                                disabled={isDisabled}
                                value={isUnsupported ? "Unsupported Field" : fieldConfig.field!.type}
                                onChange={e => {
                                    assert(fieldConfig.field)
                                    handleFieldTypeChange(fieldConfig.field.id, e.target.value as CollectionFieldType)
                                }}
                            >
                                {fieldTypeOptions.map(({ type, label }) => (
                                    <option key={type} value={type}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </Fragment>
                    )
                })}
                {fieldConfig.length > 6 && !isAtBottom && <div className="scroll-fade"></div>}
                <div ref={scrollRef} className="h-0 w-0"></div>
            </div>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 border-t border-divider border-opacity-20 items-center max-w-full">
                <Button variant="secondary" className="w-full" isLoading={isPending}>
                    {`Import from ${tableSchema.name}`}
                </Button>
            </div>
        </form>
    )
}
