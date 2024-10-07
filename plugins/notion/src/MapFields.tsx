import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { ManagedCollectionField } from "framer-plugin"
import { assert } from "./utils"
import {
    NotionProperty,
    PluginContext,
    SynchronizeMutationOptions,
    SynchronizeProgress,
    getCollectionFieldForProperty,
    getPossibleSlugFields,
    hasDatabaseFieldsChanged,
    isSupportedNotionProperty,
    supportedCMSTypeByNotionPropertyType,
    richTextToPlainText,
    getNotionProperties,
} from "./notion"
import { Fragment, useMemo, useState } from "react"
import classNames from "classnames"
import { IconChevron } from "./components/Icons"
import { Button } from "./components/Button"
import { isFullDatabase } from "@notionhq/client"
import { CheckboxTextfield } from "./components/CheckboxTexfield"

function sortProperties(propertyA: NotionProperty, propertyB: NotionProperty): number {
    // Properties that are not supported in the Plugin are displayed at the bottom of the list.
    if (!isSupportedNotionProperty(propertyA) && !isSupportedNotionProperty(propertyB)) {
        return 0
    } else if (!isSupportedNotionProperty(propertyA)) {
        return 1
    } else if (!isSupportedNotionProperty(propertyB)) {
        return -1
    }

    return -1
}

function getSortedProperties(database: GetDatabaseResponse): NotionProperty[] {
    return getNotionProperties(database).sort(sortProperties)
}

function getInitialFieldTypeState(
    database: GetDatabaseResponse,
    pluginContext: PluginContext
): Record<string, ManagedCollectionField["type"]> {
    const result: Record<string, ManagedCollectionField["type"]> = {}

    const properties = getNotionProperties(database)
    for (const property of properties) {
        if (!isSupportedNotionProperty(property)) continue

        const fieldType = supportedCMSTypeByNotionPropertyType[property.type][0]
        assert(fieldType)

        result[property.id] = fieldType
    }

    if (pluginContext.type !== "update") return result

    // If we are updating a managed collection the field type could differ from the default.
    for (const field of pluginContext.collectionFields) {
        result[field.id] = field.type
    }

    return result
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
    if (hasDatabaseFieldsChanged(pluginContext.collectionFields, database, Array.from(disabledFieldIds))) {
        return null
    }

    return pluginContext.lastSyncedTime
}

const labelByFieldTypeOption: Record<ManagedCollectionField["type"], string> = {
    boolean: "Boolean",
    date: "Date",
    number: "Number",
    formattedText: "Formatted Text",
    color: "Color",
    enum: "Enum",
    file: "File",
    image: "Image",
    link: "Link",
    string: "String",
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
    const [sortedProperties] = useState(() => getSortedProperties(database))
    const [disabledFieldIds, setDisabledFieldIds] = useState(
        () => new Set<string>(pluginContext.type === "update" ? pluginContext.ignoredFieldIds : [])
    )
    const [fieldTypeByFieldId, setFieldTypeByFieldId] = useState(() =>
        getInitialFieldTypeState(database, pluginContext)
    )
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(pluginContext)
    )

    // TODO: Render progress in UI.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, setProgress] = useState<SynchronizeProgress | null>(null)

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

    const handleFieldTypeChange = (fieldID: string, type: ManagedCollectionField["type"]) => {
        setFieldTypeByFieldId(current => ({
            ...current,
            [fieldID]: type,
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (isLoading) return

        const propertiesById = new Map<string, NotionProperty>()
        const properties = getNotionProperties(database)
        for (const property of properties) {
            propertiesById.set(property.id, property)
        }

        const cmsFields: ManagedCollectionField[] = []
        for (const fieldId in fieldTypeByFieldId) {
            if (disabledFieldIds.has(fieldId)) continue

            const property = propertiesById.get(fieldId)
            assert(property)

            if (!isSupportedNotionProperty(property)) continue

            const fieldType = fieldTypeByFieldId[fieldId]
            const fieldName = fieldNameOverrides[fieldId] ?? propertiesById.get(fieldId)?.name

            assert(fieldType)
            assert(fieldName)

            const field = getCollectionFieldForProperty(property, fieldType)
            if (!field) continue

            cmsFields.unshift(field)
        }

        assert(slugFieldId)
        setProgress(null)

        onSubmit({
            onProgress: setProgress,
            fields: cmsFields,
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
                    <label className="text-tertiary" htmlFor="collectionName">
                        Slug Field
                    </label>
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
                        <span className="col-start-3">Field Name</span>
                        <span>Field Type</span>

                        {sortedProperties.map(property => {
                            const isUnsupported = !isSupportedNotionProperty(property)

                            const fieldOptions = isSupportedNotionProperty(property)
                                ? supportedCMSTypeByNotionPropertyType[property.type]
                                : null

                            return (
                                <Fragment key={property.id}>
                                    <CheckboxTextfield
                                        value={property.name}
                                        disabled={isUnsupported}
                                        checked={!disabledFieldIds.has(property.id)}
                                        onChange={() => {
                                            handleFieldToggle(property.id)
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
                                        disabled={disabledFieldIds.has(property.id)}
                                        placeholder={property.name}
                                        value={
                                            isUnsupported
                                                ? "Unsupported Field"
                                                : (fieldNameOverrides[property.id] ?? "")
                                        }
                                        onChange={e => {
                                            handleFieldNameChange(property.id, e.target.value)
                                        }}
                                    ></input>
                                    <select
                                        className="w-auto"
                                        onChange={event =>
                                            handleFieldTypeChange(
                                                property.id,
                                                event.target.value as ManagedCollectionField["type"]
                                            )
                                        }
                                        value={fieldTypeByFieldId[property.id]}
                                    >
                                        {isUnsupported && <option disabled>Unsupported</option>}
                                        {fieldOptions?.map(fieldOption => (
                                            <option key={fieldOption} value={fieldOption}>
                                                {labelByFieldTypeOption[fieldOption]}
                                            </option>
                                        ))}
                                    </select>
                                </Fragment>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="tailwind-hell-escape-hatch-gradient-bottom" />
            <div className="left-0 bottom-0 pb-[15px] w-full flex justify-between sticky bg-primary pt-4 border-t border-divider border-opacity-20 items-center max-w-full">
                {error && <span className="text-red-500">{error.message}</span>}

                <Button variant="primary" isLoading={isLoading} disabled={!slugFieldId} className="w-full ">
                    Import from {title.trim() ? title : "Untitled"}
                </Button>
            </div>
        </form>
    )
}
