import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { CollectionField } from "framer-plugin"
import { assert, isDefined } from "./utils"
import {
    NotionProperty,
    PluginContext,
    SynchronizeMutationOptions,
    getCollectionFieldForProperty,
    getPossibleSlugFields,
    hasFieldConfigurationChanged,
    pageContentField,
    richTextToPlainText,
} from "./notion"
import { useMemo, useState } from "react"
import classNames from "classnames"
import { IconChevron } from "./components/Icons"
import { Button } from "./components/Button"
import { isFullDatabase } from "@notionhq/client"
import { CheckboxTextfield } from "./components/CheckboxTexfield"

interface CollectionFieldConfig {
    field: CollectionField | null
    isNewField: boolean
    originalFieldName: string
}

function sortField(fieldA: CollectionFieldConfig, fieldB: CollectionFieldConfig): number {
    // Sort unsupported fields to bottom
    if (!fieldA.field && !fieldB.field) {
        return 0
    } else if (!fieldA.field) {
        return 1
    } else if (!fieldB.field) {
        return -1
    }

    return -1
}

function createFieldConfig(database: GetDatabaseResponse, pluginContext: PluginContext): CollectionFieldConfig[] {
    const result: CollectionFieldConfig[] = []

    const existingFieldIds = new Set(
        pluginContext.type === "update" ? pluginContext.collectionFields.map(field => field.id) : []
    )

    result.push({
        field: pageContentField,
        originalFieldName: pageContentField.name,
        isNewField: existingFieldIds.size > 0 && !existingFieldIds.has(pageContentField.id),
    })

    for (const key in database.properties) {
        const property = database.properties[key]
        assert(property)

        result.push({
            field: getCollectionFieldForProperty(property),
            originalFieldName: property.name,
            isNewField: existingFieldIds.size > 0 && !existingFieldIds.has(property.id),
        })
    }

    return result.sort(sortField)
}

function getFieldNameOverrides(pluginContext: PluginContext): Record<string, string> {
    const result: Record<string, string> = {}
    if (pluginContext.type !== "update") return result

    for (const field of pluginContext.collectionFields) {
        result[field.id] = field.name
    }

    return result
}

function getInitialSlugFieldId(context: PluginContext, fieldOptions: NotionProperty[]): string | null {
    if (context.type === "update" && context.slugFieldId) return context.slugFieldId

    return fieldOptions[0]?.id ?? null
}

function getLastSyncedTime(
    pluginContext: PluginContext,
    database: GetDatabaseResponse,
    slugFieldId: string,
    disabledFieldIds: Set<string>
): string | null {
    if (pluginContext.type !== "update") return null

    // Always resync if the slug field changes.
    if (pluginContext.slugFieldId !== slugFieldId) return null

    // Always resync if field config changes
    if (hasFieldConfigurationChanged(pluginContext.collectionFields, database, Array.from(disabledFieldIds))) {
        return null
    }

    return pluginContext.lastSyncedTime
}

export function MapDatabaseFields({
    database,
    onSubmit,
    isLoading,
    error,
    pluginContext,
}: {
    database: GetDatabaseResponse
    onSubmit: (options: SynchronizeMutationOptions) => void
    isLoading: boolean
    error: Error | null
    pluginContext: PluginContext
}) {
    const slugFields = useMemo(() => getPossibleSlugFields(database), [database])
    const [slugFieldId, setSlugFieldId] = useState<string | null>(() =>
        getInitialSlugFieldId(pluginContext, slugFields)
    )
    const [fieldConfig] = useState<CollectionFieldConfig[]>(() => createFieldConfig(database, pluginContext))
    const [disabledFieldIds, setDisabledFieldIds] = useState(
        () => new Set<string>(pluginContext.type === "update" ? pluginContext.ignoredFieldIds : [])
    )
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(pluginContext)
    )

    assert(isFullDatabase(database))

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

        if (isLoading) return

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

        onSubmit({
            fields: allFields,
            ignoredFieldIds: Array.from(disabledFieldIds),
            slugFieldId,
            lastSyncedTime: getLastSyncedTime(pluginContext, database, slugFieldId, disabledFieldIds),
        })
    }

    const title = richTextToPlainText(database.title)

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 flex-1">
            <div className="tailwind-hell-escape-hatch-gradient-top" />

            <div className="h-[1px] border-b border-divider mb-2 sticky top-0" />

            <div className="flex-1 flex flex-col gap-6">
                <div className="flex flex-col gap-2 w-full">
                    <label className="text-tertiary" htmlFor="collectionName">Slug Field</label>
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

                <div className="flex flex-col gap-[10px] w-full items-center justify-center pb-[10px]">
                    <div className="grid grid-cols-fieldPicker gap-3 w-full items-center justify-center text-tertiary mb-[-3px]">
                        <span>Notion Property</span>
                        <span className="col-start-3">Collection Field</span>
                    </div>

                    {fieldConfig.map(fieldConfig => {
                        const isUnsupported = !fieldConfig.field

                        return (
                            <div
                                key={fieldConfig.originalFieldName}
                                className="grid grid-cols-fieldPicker gap-3 w-full items-center justify-center"
                            >
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
                                    className={classNames(
                                        "flex items-center justify-center place-self-center text-tertiary",
                                        isUnsupported && "opacity-50"
                                    )}
                                >
                                    <IconChevron />
                                </div>
                                <input
                                    type="text"
                                    className={classNames("w-full", isUnsupported && "opacity-50")}
                                    disabled={!fieldConfig.field || disabledFieldIds.has(fieldConfig.field.id)}
                                    placeholder={fieldConfig.originalFieldName}
                                    value={
                                        !fieldConfig.field
                                            ? "Unsupported Field"
                                            : fieldNameOverrides[fieldConfig.field.id] ?? ""
                                    }
                                    onChange={e => {
                                        assert(fieldConfig.field)

                                        handleFieldNameChange(fieldConfig.field.id, e.target.value)
                                    }}
                                ></input>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="left-0 bottom-0 pb-[15px] w-full flex justify-between sticky bg-primary pt-4 border-t border-divider border-opacity-20 items-center max-w-full">
                <div className="tailwind-hell-escape-hatch-gradient-bottom" />

                {error && <span className="text-red-500">{error.message}</span>}

                <Button variant="primary" isLoading={isLoading} disabled={!slugFieldId} className="w-full">
                    Import from {title.trim() ? title : "Untitled"}
                </Button>
            </div>
        </form>
    )
}
