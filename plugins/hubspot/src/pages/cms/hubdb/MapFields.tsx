import { Column, usePublishedTable } from "@/api"
import { useLoggingToggle } from "@/cms"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { Button } from "@/components/Button"
import { useSearchParams } from "@/hooks/useSearchParams"
import {
    getCollectionFieldForHubDBColumn,
    getPossibleSlugFields,
    HubDBPluginContext,
    useSyncHubDBTableMutation,
} from "@/hubdb"
import { PageProps } from "@/router"
import { assert, isDefined } from "@/utils"
import { framer } from "framer-plugin"
import { useEffect, useMemo, useState } from "react"
import { FieldMapper, ManagedCollectionFieldConfig } from "@/components/FieldMapper"

const getInitialSlugFieldId = (context: HubDBPluginContext, columns: Column[]): string | null => {
    if (context.type === "update" && context.slugFieldId) return context.slugFieldId

    const textColumns = columns.filter(col => col.type === "TEXT")
    return textColumns[0].id ?? null
}

const createFieldConfig = (columns: Column[]): ManagedCollectionFieldConfig[] => {
    return columns.map(col => ({
        field: getCollectionFieldForHubDBColumn(col),
        originalFieldName: col.label,
    }))
}

const getFieldNameOverrides = (pluginContext: HubDBPluginContext): Record<string, string> => {
    if (pluginContext.type !== "update") return {}
    return Object.fromEntries(pluginContext.collectionFields.map(field => [field.id, field.name]))
}

export default function MapHubDBFieldsPage({ hubDbPluginContext }: PageProps) {
    useLoggingToggle()

    const searchParams = useSearchParams()
    const tableId = searchParams.get("tableId")

    const { data: table, isLoading: isLoadingTable } = usePublishedTable(tableId || "")
    const slugFields = useMemo(() => getPossibleSlugFields(table?.columns || []), [table])
    const [slugFieldId, setSlugFieldId] = useState<string | null>(null)
    const [collectionFieldConfig, setCollectionFieldConfig] = useState<ManagedCollectionFieldConfig[]>([])
    const [includedFieldIds, setIncludedFieldIds] = useState(new Set<string>())
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>({})

    const { mutate: sync, isPending: isSyncing } = useSyncHubDBTableMutation({
        onError: e => framer.notify(e.message, { variant: "error" }),
        onSuccess: () => framer.closePlugin("Synchronization successful"),
    })

    useEffect(() => {
        if (!hubDbPluginContext) return

        const columns = table?.columns
        if (!columns) return

        const newIncludedFieldIds = new Set<string>(
            hubDbPluginContext.type === "update"
                ? hubDbPluginContext.includedFieldIds
                : columns.map(col => col.id).filter(isDefined)
        )

        setSlugFieldId(getInitialSlugFieldId(hubDbPluginContext, columns))
        setCollectionFieldConfig(createFieldConfig(columns))
        setIncludedFieldIds(newIncludedFieldIds)
        setFieldNameOverrides(getFieldNameOverrides(hubDbPluginContext))
    }, [hubDbPluginContext, table])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const allFields = collectionFieldConfig
            .filter(fieldConfig => fieldConfig.field && includedFieldIds.has(fieldConfig.field.id))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                if (fieldNameOverrides[field.id]) {
                    field.name = fieldNameOverrides[field.id]
                }
                return field
            })

        assert(slugFieldId)
        assert(tableId)

        sync({
            fields: allFields,
            tableId,
            slugFieldId,
            includedFieldIds: Array.from(includedFieldIds),
        })
    }

    if (isLoadingTable) return <CenteredSpinner size="medium" />

    if (!tableId) return <div>Expected `tableId` query param</div>

    return (
        <form onSubmit={handleSubmit} className="h-full px-[15px] pb-[15px]">
            <div className="col w-full text-tertiary pt-[15px]">
                <label htmlFor="slugField">Slug Field</label>
                <select
                    className="w-full"
                    value={slugFieldId ?? ""}
                    onChange={e => setSlugFieldId(e.target.value)}
                    id="slugField"
                    required
                >
                    {slugFields.map(field => (
                        <option key={field.id} value={field.id}>
                            {field.label}
                        </option>
                    ))}
                </select>
            </div>
            <FieldMapper
                collectionFieldConfig={collectionFieldConfig}
                fieldNameOverrides={fieldNameOverrides}
                isFieldSelected={fieldId => includedFieldIds.has(fieldId)}
                onFieldToggle={fieldId => {
                    setIncludedFieldIds(current => {
                        const nextSet = new Set(current)
                        if (nextSet.has(fieldId)) {
                            nextSet.delete(fieldId)
                        } else {
                            nextSet.add(fieldId)
                        }
                        return nextSet
                    })
                }}
                onFieldNameChange={(fieldId, value) => {
                    setFieldNameOverrides(current => ({
                        ...current,
                        [fieldId]: value,
                    }))
                }}
                className="pb-[15px] mt-2.5"
            />
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary pt-[15px] border-t border-divider items-center max-w-full">
                <Button variant="secondary" className="w-full" isLoading={isSyncing}>
                    Import {table ? table.label : "Untitled"}
                </Button>
            </div>
        </form>
    )
}