import { HubDBColumn, usePublishedTable } from "@/api"
import { useLoggingToggle } from "@/cms"
import { CheckboxTextfield } from "@/components/CheckboxTextField"
import { IconChevron } from "@/components/Icons"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import { useSearchParams } from "@/hooks/useSearchParams"
import {
    getCollectionFieldForHubDBColumn,
    getPossibleSlugFields,
    HubDBPluginContext,
    useSyncHubDBTableMutation,
} from "@/hubdb"
import { PageProps } from "@/router"
import { assert, isDefined } from "@/utils"
import { framer, ManagedCollectionField } from "framer-plugin"
import { Fragment, useEffect, useMemo, useState } from "react"
import classNames from "classnames"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { Button } from "@/components/Button"

interface ManagedCollectionFieldConfig {
    field: ManagedCollectionField | null
    isNewField: boolean
    originalFieldName: string
}

const sortField = (
    fieldA: ManagedCollectionFieldConfig,
    fieldB: ManagedCollectionFieldConfig,
    includedFieldNames: Set<string>
): number => {
    // Fields that were previously included
    const aWasIncluded = fieldA.field && includedFieldNames.has(fieldA.field.id)
    const bWasIncluded = fieldB.field && includedFieldNames.has(fieldB.field.id)

    if (aWasIncluded && !bWasIncluded) return -1
    if (!aWasIncluded && bWasIncluded) return 1

    // Then sort by whether they are supported fields
    if (fieldA.field && !fieldB.field) return -1
    if (!fieldA.field && fieldB.field) return 1

    return 0
}

const getInitialSlugFieldName = (context: HubDBPluginContext, columns: HubDBColumn[]): string | null => {
    if (context.type === "update" && context.slugFieldName) return context.slugFieldName

    return columns[0].name ?? null
}

const createFieldConfig = (
    columns: HubDBColumn[],
    includedFieldNames: Set<string>,
    context: HubDBPluginContext
): ManagedCollectionFieldConfig[] => {
    const existingFieldIds = new Set(context.type === "update" ? context.collectionFields.map(field => field.id) : [])

    return columns
        .map(col => ({
            field: getCollectionFieldForHubDBColumn(col),
            originalFieldName: col.label,
            isNewField: existingFieldIds.size > 0 && !existingFieldIds.has(col.id),
        }))
        .sort((a, b) => sortField(a, b, includedFieldNames))
}

const getFieldNameOverrides = (pluginContext: HubDBPluginContext): Record<string, string> => {
    if (pluginContext.type !== "update") return {}

    return Object.fromEntries(pluginContext.collectionFields.map(field => [field.id, field.name]))
}

export default function MapHubDBFieldsPage({ hubDBPluginContext }: PageProps) {
    useLoggingToggle()

    const [{ tableId }] = useSearchParams<{ tableId: string }>()
    const { data: table, isLoading: isLoadingTable } = usePublishedTable(tableId)

    const slugFields = useMemo(() => getPossibleSlugFields(table?.columns || []), [table])
    const [slugFieldName, setSlugFieldName] = useState<string | null>(null)
    const [collectionFieldConfig, setCollectionFieldConfig] = useState<ManagedCollectionFieldConfig[]>([])
    const [includedFieldNames, setIncludedFieldNames] = useState(new Set<string>())
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>({})

    const { mutate: sync, isPending: isSyncing } = useSyncHubDBTableMutation({
        onError: e => framer.notify(e.message, { variant: "error" }),
        onSuccess: () => framer.closePlugin("Synchronization successful"),
    })

    useEffect(() => {
        if (!hubDBPluginContext) return

        const columns = table?.columns
        if (!columns) return

        const newIncludedFieldNames = new Set<string>(
            hubDBPluginContext.type === "update" ? hubDBPluginContext.includedFieldNames : columns.map(col => col.name)
        )

        setSlugFieldName(getInitialSlugFieldName(hubDBPluginContext, columns))
        setCollectionFieldConfig(createFieldConfig(columns, newIncludedFieldNames, hubDBPluginContext))
        setIncludedFieldNames(newIncludedFieldNames)
        setFieldNameOverrides(getFieldNameOverrides(hubDBPluginContext))
    }, [hubDBPluginContext, table])

    const handleFieldToggle = (fieldName: string) => {
        setIncludedFieldNames(current => {
            const nextSet = new Set(current)
            if (nextSet.has(fieldName)) {
                nextSet.delete(fieldName)
            } else {
                nextSet.add(fieldName)
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

        const allFields = collectionFieldConfig
            .filter(fieldConfig => fieldConfig.field && includedFieldNames.has(fieldConfig.field.id))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                if (fieldNameOverrides[field.id]) {
                    field.name = fieldNameOverrides[field.id]
                }

                return field
            })

        assert(slugFieldName)

        sync({
            fields: allFields,
            tableId,
            slugFieldName,
            includedFieldNames: Array.from(includedFieldNames),
        })
    }

    if (isLoadingTable) return <CenteredSpinner className="w-[340px] h-[446px]" size="medium" />

    return (
        <form onSubmit={handleSubmit} className="col gap-2.5 flex-1 text-tertiary w-[340px] px-[15px] pt-[15px]">
            <div className="flex flex-col h-fit">
                <div className="flex flex-col gap-2.5 w-full">
                    <label htmlFor="collectionName">Slug Field</label>
                    <select
                        className="w-full"
                        value={slugFieldName ?? ""}
                        onChange={e => setSlugFieldName(e.target.value)}
                        required
                    >
                        {slugFields.map(field => (
                            <option key={field.id} value={field.name}>
                                {field.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <ScrollFadeContainer height={290} className="pb-[5px]">
                <div className="grid grid-cols-fieldPicker items-center gap-2.5 mt-3">
                    <span className="col-span-2">Column</span>
                    <span>Field</span>
                    {collectionFieldConfig.map((fieldConfig, i) => {
                        const isUnsupported = !fieldConfig.field
                        return (
                            <Fragment key={i}>
                                <CheckboxTextfield
                                    value={fieldConfig.originalFieldName}
                                    disabled={!fieldConfig.field}
                                    checked={!!fieldConfig.field && includedFieldNames.has(fieldConfig.field.id)}
                                    onChange={() => {
                                        assert(fieldConfig.field)
                                        handleFieldToggle(fieldConfig.field.id)
                                    }}
                                />
                                <div
                                    className={classNames("flex items-center justify-center", {
                                        "opacity-50": isUnsupported,
                                    })}
                                >
                                    <IconChevron />
                                </div>
                                <input
                                    type="text"
                                    className={classNames("w-full", { "opacity-50": isUnsupported })}
                                    disabled={!fieldConfig.field || !includedFieldNames.has(fieldConfig.field.id)}
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
                </div>
            </ScrollFadeContainer>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 border-t border-divider border-opacity-20 items-center max-w-full">
                <Button variant="secondary" className="w-full" isLoading={isSyncing}>
                    {`Import from ${table ? table.label : "Untitled"}`}
                </Button>
            </div>
        </form>
    )
}
