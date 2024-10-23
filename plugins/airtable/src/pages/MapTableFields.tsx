import { Fragment, useMemo, useState } from "react"
import { ManagedCollectionField } from "framer-plugin"
import { useInView } from "react-intersection-observer"
import cx from "classnames"
import { assert, isDefined } from "../utils"
import { AirtableFieldSchema, AirtableTableSchema } from "../api"
import {
    getCollectionForAirtableField,
    getPossibleSlugFields,
    hasFieldConfigurationChanged,
    PluginContext,
    SyncMutationOptions,
    SyncProgress,
} from "../airtable"

import { Button } from "../components/Button"
import { IconChevron } from "../components/Icons"
import { CheckboxTextfield } from "@/components/CheckboxTextField"

interface ManagedCollectionFieldConfig {
    field: ManagedCollectionField | null
    isNewField: boolean
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
    pluginContext: PluginContext,
    tableSchema: AirtableTableSchema,
    slugFieldId: string,
    ignoredFieldIds: Set<string>
): string | null => {
    if (pluginContext.type !== "update") return null

    // Always resync if the slug field changes.
    if (pluginContext.slugFieldId !== slugFieldId) return null

    // Always resync if field config changes.
    if (hasFieldConfigurationChanged(pluginContext.collectionFields, tableSchema, Array.from(ignoredFieldIds))) {
        return null
    }

    return pluginContext.lastSyncedTime
}

const createFieldConfig = (
    primaryFieldId: string,
    fieldSchemas: AirtableFieldSchema[],
    pluginContext: PluginContext
): ManagedCollectionFieldConfig[] => {
    const result: ManagedCollectionFieldConfig[] = []
    const existingFieldIds = new Set(
        pluginContext.type === "update" ? pluginContext.collectionFields.map(field => field.id) : []
    )

    for (const fieldSchema of fieldSchemas) {
        result.push({
            field: getCollectionForAirtableField(fieldSchema),
            originalFieldName: fieldSchema.name,
            isNewField: existingFieldIds.size > 0 && !existingFieldIds.has(fieldSchema.id),
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

interface Props {
    baseId: string
    tableId: string
    tableSchema: AirtableTableSchema
    pluginContext: PluginContext
    onSubmit: (opts: SyncMutationOptions) => void
    isPending: boolean
}

export function MapTableFieldsPage({ baseId, tableId, pluginContext, onSubmit, isPending, tableSchema }: Props) {
    const { ref: scrollRef, inView: isAtBottom } = useInView({ threshold: 1 })
    const slugFields = useMemo(() => getPossibleSlugFields(tableSchema.fields), [tableSchema])
    const [slugFieldId, setSlugFieldId] = useState<string | null>(() =>
        getInitialSlugFieldId(pluginContext, tableSchema.primaryFieldId)
    )
    const [fieldConfig] = useState<ManagedCollectionFieldConfig[]>(() =>
        createFieldConfig(tableSchema.primaryFieldId, tableSchema.fields, pluginContext)
    )
    const [disabledFieldIds, setDisabledFieldIds] = useState(
        () => new Set<string>(pluginContext.type === "update" ? pluginContext.ignoredFieldIds : [])
    )
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(pluginContext)
    )

    // TODO: Render progress in UI
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, setProgress] = useState<SyncProgress | null>(null)

    const handleFieldToggle = (key: string) => {
        setDisabledFieldIds(current => {
            const nextSet = new Set(current)
            if (nextSet.has(key)) {
                nextSet.delete(key)
            } else {
                nextSet.add(key)
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
            lastSyncedTime: getLastSyncedTime(pluginContext, tableSchema, slugFieldId, disabledFieldIds),
            ignoredFieldIds: Array.from(disabledFieldIds),
            fields: allFields,
            slugFieldId,
            baseId,
            tableId,
            tableSchema,
        })
    }

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
                {fieldConfig.map((fieldConfig, i) => {
                    const isUnsupported = !fieldConfig.field

                    return (
                        <Fragment key={i}>
                            <CheckboxTextfield
                                value={fieldConfig.originalFieldName}
                                disabled={!fieldConfig.field}
                                checked={!!fieldConfig.field && !disabledFieldIds.has(fieldConfig.field.id)}
                                onChange={() => {
                                    assert(fieldConfig.field)

                                    handleFieldToggle(fieldConfig.field.id)
                                }}
                            />
                            <div
                                className={cx("flex items-center justify-center", {
                                    "opacity-50": isUnsupported,
                                })}
                            >
                                <IconChevron />
                            </div>
                            <input
                                type="text"
                                className={cx("w-full", { "opacity-50": isUnsupported })}
                                disabled={!fieldConfig.field || disabledFieldIds.has(fieldConfig.field.id)}
                                placeholder={fieldConfig.originalFieldName}
                                value={
                                    !fieldConfig.field
                                        ? "Unsupported Field"
                                        : (fieldNameOverrides[fieldConfig.field.id] ?? "")
                                }
                                onChange={e => {
                                    assert(fieldConfig.field)

                                    handleFieldNameChange(fieldConfig.field.id, e.target.value)
                                }}
                            />
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
