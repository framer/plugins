import { isFullDatabase } from "@notionhq/client"
import type { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import classNames from "classnames"
import { type ManagedCollectionField, type ManagedCollectionFieldInput, useIsAllowedTo } from "framer-plugin"
import { Fragment, useMemo, useState } from "react"
import { Button } from "./components/Button"
import { CheckboxTextfield } from "./components/CheckboxTexfield"
import { IconChevron } from "./components/Icons"
import {
    getCollectionFieldForProperty,
    getNotionProperties,
    getPossibleSlugFields,
    hasDatabaseFieldsChanged,
    hasFieldConfigurationChanged,
    isSupportedNotionProperty,
    type NotionProperty,
    type PluginContext,
    richTextToPlainText,
    type SynchronizeMutationOptions,
    type SynchronizeProgress,
    supportedCMSTypeByNotionPropertyType,
} from "./notion"
import { assert, syncMethods } from "./utils"

function getSortedProperties(database: GetDatabaseResponse): NotionProperty[] {
    return getNotionProperties(database).sort((propertyA, propertyB) => {
        const a = isSupportedNotionProperty(propertyA) ? -1 : 0
        const b = isSupportedNotionProperty(propertyB) ? -1 : 0
        return a - b
    })
}

function getInitialFieldTypeState(
    properties: NotionProperty[],
    pluginContext: PluginContext
): Record<string, ManagedCollectionField["type"]> {
    const result: Record<string, ManagedCollectionField["type"]> = {}

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

function getLastSynchronizedAtTimestamp(
    pluginContext: PluginContext,
    database: GetDatabaseResponse,
    fields: ManagedCollectionFieldInput[],
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

    // If the field configuration such as types changed always resync.
    if (hasFieldConfigurationChanged(pluginContext.collectionFields, fields)) {
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
    collectionReference: "Reference",
    multiCollectionReference: "Multi Reference",
}

export function MapDatabaseFields({
    database,
    onSubmit,
    isLoading,
    pluginContext,
}: {
    database: GetDatabaseResponse
    onSubmit: (options: SynchronizeMutationOptions) => void
    isLoading: boolean
    pluginContext: PluginContext
}) {
    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    const slugFields = useMemo(() => getPossibleSlugFields(database), [database])
    const [slugFieldId, setSlugFieldId] = useState<string | null>(() =>
        getInitialSlugFieldId(pluginContext, slugFields)
    )
    const [notionProperties] = useState(() => getSortedProperties(database))
    const [disabledFieldIds, setDisabledFieldIds] = useState(
        () => new Set<string>(pluginContext.type === "update" ? pluginContext.ignoredFieldIds : [])
    )
    const [fieldTypeByFieldId, setFieldTypeByFieldId] = useState(() =>
        getInitialFieldTypeState(notionProperties, pluginContext)
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

        const cmsFields: ManagedCollectionFieldInput[] = []
        for (const property of notionProperties) {
            if (!isSupportedNotionProperty(property)) continue
            if (disabledFieldIds.has(property.id)) continue

            const fieldType = fieldTypeByFieldId[property.id]
            assert(fieldType)

            const field = getCollectionFieldForProperty(property, fieldType, pluginContext.databaseIdMap)
            if (!field) continue

            const nameOverride = fieldNameOverrides[property.id]
            if (nameOverride) {
                field.name = nameOverride
            }

            cmsFields.push(field)
        }

        assert(slugFieldId)
        setProgress(null)

        onSubmit({
            onProgress: setProgress,
            fields: cmsFields,
            ignoredFieldIds: Array.from(disabledFieldIds),
            slugFieldId,
            lastSyncedTime: getLastSynchronizedAtTimestamp(
                pluginContext,
                database,
                cmsFields,
                slugFieldId,
                disabledFieldIds
            ),
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
                        className={classNames("w-full", !isAllowedToManage && "opacity-50")}
                        value={slugFieldId ?? ""}
                        onChange={e => setSlugFieldId(e.target.value)}
                        disabled={!isAllowedToManage}
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

                        {notionProperties.map(property => {
                            const isSupported = isSupportedNotionProperty(property)
                            const fieldOptions = isSupported
                                ? supportedCMSTypeByNotionPropertyType[property.type]
                                : null

                            return (
                                <Fragment key={property.id}>
                                    <CheckboxTextfield
                                        value={property.name}
                                        disabled={!isSupported || !isAllowedToManage}
                                        checked={!disabledFieldIds.has(property.id)}
                                        onChange={() => {
                                            handleFieldToggle(property.id)
                                        }}
                                    />
                                    <div
                                        className={classNames(
                                            "flex items-center justify-center place-self-center text-tertiary",
                                            (!isSupported || !isAllowedToManage) && "opacity-50"
                                        )}
                                    >
                                        <IconChevron />
                                    </div>
                                    <input
                                        type="text"
                                        className={classNames(
                                            "w-full",
                                            (!isSupported || !isAllowedToManage) && "opacity-50"
                                        )}
                                        disabled={
                                            !isSupported || !isAllowedToManage || disabledFieldIds.has(property.id)
                                        }
                                        placeholder={property.name}
                                        value={isSupported ? (fieldNameOverrides[property.id] ?? "") : "Unsupported"}
                                        onChange={e => {
                                            handleFieldNameChange(property.id, e.target.value)
                                        }}
                                    ></input>
                                    <select
                                        className={classNames(
                                            "w-full",
                                            (!isSupported || !isAllowedToManage) && "opacity-50"
                                        )}
                                        onChange={event =>
                                            handleFieldTypeChange(
                                                property.id,
                                                event.target.value as ManagedCollectionField["type"]
                                            )
                                        }
                                        disabled={!isSupported || !isAllowedToManage}
                                        value={!isSupported ? "unsupported" : fieldTypeByFieldId[property.id]}
                                    >
                                        {!isSupported && (
                                            <option value="unsupported" disabled>
                                                Unsupported
                                            </option>
                                        )}
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

            <div className="left-0 bottom-0 pb-[15px] w-full flex justify-between sticky bg-primary pt-4 border-t border-divider border-opacity-20 items-center max-w-full">
                <div className="tailwind-hell-escape-hatch-gradient-bottom" />

                <Button
                    variant="primary"
                    isLoading={isLoading}
                    onClick={handleSubmit}
                    disabled={!slugFieldId || !isAllowedToManage}
                    title={!isAllowedToManage ? "Insufficient permissions" : undefined}
                >
                    Import from {title.trim() ? title : "Untitled"}
                </Button>
            </div>
        </form>
    )
}
