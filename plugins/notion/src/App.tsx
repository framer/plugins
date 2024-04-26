import { framer, CollectionField } from "framer-plugin"
import { FormEvent, Fragment, useEffect, useMemo, useState } from "react"
import "./App.css"
import {
    PluginConfig,
    SynchronizeMutationOptions,
    getCollectionFieldForProperty,
    getPossibleSlugFields,
    notionClient,
    richTextToPlainText,
    useDatabasesQuery,
    useSynchronizeDatabaseMutation,
} from "./notion"

import { GetDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"
import { assert, isDefined } from "./utils"

import { Spinner } from "./components/Spinner"
import { IconChevron, ReloadIcon } from "./components/Icons"
import notionConnectSrc from "./assets/notion-connect.png"
import classNames from "classnames"

interface SelectDatabaseProps {
    onDatabaseSelected: (database: GetDatabaseResponse) => void
}

function DatabaseSearch({ onDatabaseSelected }: SelectDatabaseProps) {
    const { data, refetch, isRefetching, isLoading } = useDatabasesQuery()
    const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null)

    useEffect(() => {
        const firstItem = data?.[0]
        if (!firstItem) return

        setSelectedDatabase(firstItem.id)
    }, [data])

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault()

        assert(data)

        const database = data.find(database => database.id === selectedDatabase)
        if (!database) {
            setSelectedDatabase(null)
            return
        }

        onDatabaseSelected(database)
    }

    return (
        <form className="flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
            <img src={notionConnectSrc} className="rounded-md" />
            <p>
                Connect your databases with Framer: open a database in Notion, click the ... button in the top-right
                corner of the page, then pick Connections → Connect to → Framer.
            </p>
            <div className="inline-flex gap-2 items-center">
                <span>Database</span>
                <button
                    className="w-[32px] h[16px] bg-transparent flex items-center justify-center text-secondary"
                    type="button"
                    onClick={() => refetch()}
                >
                    <ReloadIcon className={isRefetching || isLoading ? "animate-spin" : undefined} />
                </button>
                <select
                    value={selectedDatabase ?? ""}
                    onChange={e => setSelectedDatabase(e.target.value)}
                    className="ml-auto min-w-[50%]"
                    disabled={data && data.length === 0}
                >
                    {isLoading && <option>Loading...</option>}
                    {data && data.length === 0 && <option>No databases...</option>}
                    {data?.map(database => (
                        <option key={database.id} value={database.id}>
                            {richTextToPlainText(database.title)}
                        </option>
                    ))}
                </select>
            </div>
            <button className="framer-button-primary" type="submit" disabled={!selectedDatabase}>
                Next
            </button>
        </form>
    )
}

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

    // Comes in in reverse yolo improve this
    return -1
}

function createFieldConfig(database: GetDatabaseResponse, initialFields: CollectionField[]): CollectionFieldConfig[] {
    const result: CollectionFieldConfig[] = []

    const existingFieldIds = new Set(initialFields.map(field => field.key))

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

function getFieldNameOverrides(fields: CollectionField[]): Record<string, string> {
    const result: Record<string, string> = {}

    for (const field of fields) {
        result[field.key] = field.name
    }

    return result
}

function MapDatabaseField({
    database,
    onSubmit,
    isLoading,
    ignoredFieldIds,
    initialFields,
}: {
    database: GetDatabaseResponse
    onSubmit: (options: SynchronizeMutationOptions) => void
    isLoading: boolean
    initialFields: CollectionField[]
    ignoredFieldIds: string[]
}) {
    const { options: slugFieldOptions, suggestedFieldId } = useMemo(() => getPossibleSlugFields(database), [database])

    const [fieldConfig] = useState<CollectionFieldConfig[]>(() => createFieldConfig(database, initialFields))
    const [disabledFieldIds, setDisabledFieldIds] = useState(() => new Set<string>(ignoredFieldIds))
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(initialFields)
    )
    const [slugFieldId, setSlugFieldId] = useState<string | null>(suggestedFieldId)

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

    const handleFieldNameChange = (key: string, value: string) => {
        setFieldNameOverrides(current => ({
            ...current,
            [key]: value,
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (isLoading) return

        assert(slugFieldId)

        const allFields = fieldConfig
            .filter(fieldConfig => fieldConfig.field && !disabledFieldIds.has(fieldConfig.field.key))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                if (fieldNameOverrides[field.key]) {
                    field.name = fieldNameOverrides[field.key]
                }

                return field
            })

        onSubmit({
            slugFieldId,
            fields: allFields,
            ignoredFieldIds: Array.from(disabledFieldIds),
        })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 flex-1">
            <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-col gap-2 w-full py-2">
                    <label htmlFor="collectionName" className="font-semibold">
                        Slug Field
                    </label>
                    <select
                        className="w-full"
                        value={slugFieldId ?? ""}
                        onChange={e => setSlugFieldId(e.target.value)}
                        required
                    >
                        {slugFieldOptions.map(field => (
                            <option key={field.id} value={field.id}>
                                {field.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols-fieldPicker gap-3 w-full items-center justify-center">
                    <span className="col-start-2 col-span-2 font-semibold">Notion Property</span>
                    <span className="font-bold">Collection Field</span>
                    {fieldConfig.map(fieldConfig => {
                        const isUnsupported = !fieldConfig.field

                        return (
                            <Fragment key={fieldConfig.originalFieldName}>
                                <input
                                    type="checkbox"
                                    disabled={!fieldConfig.field}
                                    checked={!!fieldConfig.field && !disabledFieldIds.has(fieldConfig.field.key)}
                                    className={classNames(isUnsupported && "opacity-50")}
                                    onChange={() => {
                                        assert(fieldConfig.field)

                                        handleFieldToggle(fieldConfig.field.key)
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
                                    type=""
                                    className={classNames("w-full", isUnsupported && "opacity-50")}
                                    disabled={!fieldConfig.field || disabledFieldIds.has(fieldConfig.field.key)}
                                    placeholder={fieldConfig.originalFieldName}
                                    value={
                                        !fieldConfig.field
                                            ? "Unsupported Field"
                                            : fieldNameOverrides[fieldConfig.field.key] ?? ""
                                    }
                                    onChange={e => {
                                        assert(fieldConfig.field)

                                        handleFieldNameChange(fieldConfig.field.key, e.target.value)
                                    }}
                                ></input>
                            </Fragment>
                        )
                    })}
                </div>
            </div>

            <div className="left-0 bottom-0 w-full h-[50px] flex justify-end sticky bg-primary py-2 border-t border-divider border-opacity-20">
                <button type="submit" className="w-auto framer-button-primary relative">
                    <span className={isLoading ? "invisible" : undefined}>Import</span>
                    {isLoading && (
                        <div className="absolute top-0 right-0 left-0 bottom-0 flex items-center justify-center">
                            <Spinner />
                        </div>
                    )}
                </button>
            </div>
        </form>
    )
}

export function App({ config }: { config: PluginConfig }) {
    const [databaseConfig, setDatabaseConfig] = useState<GetDatabaseResponse | null>(config.database)

    const synchronizeMutation = useSynchronizeDatabaseMutation(databaseConfig, {
        onSuccess(result) {
            if (result.status === "success") {
                framer.closePlugin("Synchronization successful")
                return
            }
        },
    })

    // Logging only - remove
    useEffect(() => {
        if (databaseConfig) {
            notionClient.databases
                .query({
                    database_id: databaseConfig.id,
                })
                .then(console.log)
        }
    }, [databaseConfig])

    if (synchronizeMutation.data?.status === "completed_with_errors") {
        return (
            // TODO: implement
            <div>
                Succeeded with errors:
                <div>{JSON.stringify(synchronizeMutation.data.errors, null, 2)}</div>
            </div>
        )
    }

    if (!databaseConfig) {
        return <DatabaseSearch onDatabaseSelected={setDatabaseConfig} />
    }

    return (
        <MapDatabaseField
            database={databaseConfig}
            ignoredFieldIds={config.ignoredFieldIds}
            initialFields={config.collectionFields}
            onSubmit={synchronizeMutation.mutate}
            isLoading={synchronizeMutation.isPending}
        />
    )
}
