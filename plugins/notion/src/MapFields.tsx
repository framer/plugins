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
import { Fragment, useMemo, useState } from "react"
import classNames from "classnames"
import { IconChevron } from "./components/Icons"
import { Button } from "./components/Button"
import { isFullDatabase } from "@notionhq/client"

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

        // Title is always required in CMS API.
        if (property.type === "title") continue

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

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 flex-1">
            <div className="h-[1px] border-b border-divider mb-2 sticky top-0" />
            <div className="flex-1 flex flex-col gap-4">
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
                <div className="grid grid-cols-fieldPicker gap-3 w-full items-center justify-center">
                    <span className="col-start-2 col-span-2">Notion Property</span>
                    <span>Collection Field</span>
                    <input type="checkbox" readOnly checked={true} className="opacity-50 mx-auto" />
                    <input type="text" className="w-full opacity-50" disabled value={"Title"} />
                    <div className="flex items-center justify-center opacity-50">
                        <IconChevron />
                    </div>
                    <input type="text" className={"w-full opacity-50"} disabled={true} placeholder={"Title"}></input>

                    {fieldConfig.map(fieldConfig => {
                        const isUnsupported = !fieldConfig.field

                        return (
                            <Fragment key={fieldConfig.originalFieldName}>
                                <input
                                    type="checkbox"
                                    disabled={!fieldConfig.field}
                                    checked={!!fieldConfig.field && !disabledFieldIds.has(fieldConfig.field.id)}
                                    className={classNames("mx-auto", isUnsupported && "opacity-50")}
                                    onChange={() => {
                                        assert(fieldConfig.field)

                                        handleFieldToggle(fieldConfig.field.id)
                                    }}
                                />
                                <input
                                    type="text"
                                    className={classNames("w-full", isUnsupported && "opacity-50")}
                                    disabled
                                    value={fieldConfig.originalFieldName}
                                />
                                <div
                                    className={classNames(
                                        "flex items-center justify-center",
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
                            </Fragment>
                        )
                    })}
                </div>
            </div>

            <div className="left-0 bottom-0 w-full flex justify-between sticky bg-primary py-4 border-t border-divider border-opacity-20 items-center max-w-full overflow-hidden">
                <div className="inline-flex items-center gap-1 min-w-0">
                    {error ? (
                        <span className="text-red-500">{error.message}</span>
                    ) : (
                        <>
                            <span className="text-tertiary flex-shrink-0">Importing from</span>
                            <a
                                href={database.url}
                                className="font-semibold text-secondary hover:text-primary truncate"
                                target="_blank"
                                tabIndex={-1}
                            >
                                {richTextToPlainText(database.title)}
                            </a>
                        </>
                    )}
                </div>
                <Button variant="primary" isLoading={isLoading} disabled={!slugFieldId} className="w-auto">
                    Import
                </Button>
            </div>
        </form>
    )
}
