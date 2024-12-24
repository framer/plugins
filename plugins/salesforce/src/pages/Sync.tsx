import { framer } from "framer-plugin"
import {
    getCollectionFieldForSalesforceField,
    getPossibleSlugFields,
    ObjectIdMap,
    PluginContext,
    SyncProgress,
    useSyncRecordsMutation,
} from "@/cms"
import { SFFieldConfig, useObjectConfigQuery } from "@/api"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "@/hooks/useSearchParams"
import { assert, isDefined } from "@/utils"
import { logSyncResult, PLUGIN_LOG_SYNC_KEY } from "@/debug"
import { Button } from "@/components/Button"
import { CenteredSpinner } from "@/components/CenteredSpinner"
import { PageProps } from "@/router"
import { FieldMapper, ManagedCollectionFieldConfig } from "@/components/FieldMapper"
import { PluginError } from "@/PluginError"

// Due to the number of fields an object can have, we deprioritize some system created fields by
// default, as they're unlikely to be used
const LOW_PRIORITY_FIELDS = [
    "Id",
    "OwnerId",
    "IsDeleted",
    "CreatedDate",
    "CreatedById",
    "LastModifiedDate",
    "LastModifiedById",
    "SystemModstamp",
]

const useLoggingToggle = () => {
    useEffect(() => {
        const isLoggingEnabled = () => localStorage.getItem(PLUGIN_LOG_SYNC_KEY) === "true"

        const toggle = () => {
            const newState = !isLoggingEnabled()
            localStorage.setItem(PLUGIN_LOG_SYNC_KEY, newState ? "true" : "false")
            framer.notify(`Logging ${newState ? "enabled" : "disabled"}`, { variant: "info" })
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "L") {
                e.preventDefault()
                toggle()
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [])
}

const getInitialSlugFieldId = (context: PluginContext): string | null => {
    if (context.type === "update" && context.slugFieldId) return context.slugFieldId

    // All objects have this property
    return "Id"
}

const createFieldConfig = (fieldConfigs: SFFieldConfig[], objectIdMap: ObjectIdMap): ManagedCollectionFieldConfig[] => {
    const includedFields = fieldConfigs.filter(field => !LOW_PRIORITY_FIELDS.includes(field.name))
    const excludedFields = fieldConfigs.filter(field => LOW_PRIORITY_FIELDS.includes(field.name))
    const fields = [...includedFields, ...excludedFields]

    return fields.map(fieldConfig => ({
        field: getCollectionFieldForSalesforceField(fieldConfig, objectIdMap),
        originalFieldName: fieldConfig.label,
    }))
}

const getFieldNameOverrides = (pluginContext: PluginContext): Record<string, string> => {
    if (pluginContext.type !== "update") return {}

    return Object.fromEntries(pluginContext.collectionFields.map(field => [field.id, field.name]))
}

export default function Sync({ pluginContext }: PageProps) {
    useLoggingToggle()

    const params = useSearchParams()
    const objectName = params.get("objectName")
    const objectLabel = params.get("objectLabel")

    const { data: objectConfig, isLoading: isLoadingObjectConfig } = useObjectConfigQuery(objectName || "")
    const slugFields = useMemo(() => getPossibleSlugFields(objectConfig?.fields || []), [objectConfig?.fields])

    const [slugFieldId, setSlugFieldId] = useState<string | null>(null)
    const [collectionFieldConfig, setCollectionFieldConfig] = useState<ManagedCollectionFieldConfig[]>([])
    const [includedFieldIds, setIncludedFieldIds] = useState(new Set<string>())
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>({})
    const [, setProgress] = useState<SyncProgress | null>(null)

    useEffect(() => {
        if (!pluginContext || !objectConfig) return

        const newIncludedFieldNames = new Set<string>(
            pluginContext.type === "update" ? pluginContext.includedFieldIds : []
        )

        setSlugFieldId(getInitialSlugFieldId(pluginContext))
        setCollectionFieldConfig(createFieldConfig(objectConfig.fields || [], pluginContext.objectIdMap))
        setIncludedFieldIds(newIncludedFieldNames)
        setFieldNameOverrides(getFieldNameOverrides(pluginContext))
    }, [pluginContext, objectConfig])

    const { mutate: sync, isPending: isSyncing } = useSyncRecordsMutation({
        onSuccess: result => {
            logSyncResult(result)
            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
                return
            }
        },
        onError: e => framer.notify(e.message, { variant: "error" }),
    })

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
        assert(objectConfig)
        assert(typeof objectLabel === "string")
        assert(typeof objectName === "string")
        setProgress(null)

        sync({
            objectId: objectName,
            objectLabel,
            onProgress: setProgress,
            includedFieldIds: Array.from(includedFieldIds),
            fieldConfigs: objectConfig.fields,
            fields: allFields,
            slugFieldId,
        })
    }

    if (!objectName || !objectLabel) {
        throw new PluginError("Invalid Params", "Expected 'objectName' and 'objectLabel' query params")
    }

    if (!pluginContext || isLoadingObjectConfig) {
        return <CenteredSpinner size="medium" />
    }

    return (
        <form onSubmit={handleSubmit} className="h-full px-[15px] pb-[15px]">
            <div className="col w-full text-tertiary pt-[15px]">
                <label htmlFor="slugField">Slug Field</label>
                <select
                    className="w-full"
                    value={slugFieldId ?? ""}
                    onChange={e => setSlugFieldId(e.target.value)}
                    required
                >
                    {slugFields.map(field => (
                        <option key={field.name} value={field.name}>
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
                onFieldNameChange={(id, value) => {
                    setFieldNameOverrides(current => ({
                        ...current,
                        [id]: value,
                    }))
                }}
                fromLabel="Salesforce Field"
                toLabel="Collection Field"
                className="pb-[15px] mt-2.5"
            />
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary pt-[15px] border-t border-divider items-center max-w-full">
                <Button variant="secondary" className="w-full" isLoading={isSyncing}>
                    Import {objectLabel}
                </Button>
            </div>
        </form>
    )
}
