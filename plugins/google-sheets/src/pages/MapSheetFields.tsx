import { Fragment, useMemo, useState } from "react"
import { CollectionField } from "framer-plugin"
import { useInView } from "react-intersection-observer"
import cx from "classnames"
import { assert, isDefined } from "../utils"
import {
    CellValue,
    CollectionFieldType,
    hasFieldConfigurationChanged,
    HeaderRow,
    PluginContext,
    Row,
    SyncMutationOptions,
} from "../sheets"

import { IconChevron } from "../components/Icons"
import { Button } from "../components/Button"

interface CollectionFieldConfig {
    field: CollectionField | null
    originalFieldName: string
}

interface FieldTypeOption {
    type: CollectionFieldType
    label: string
}

const fieldTypeOptions: FieldTypeOption[] = [
    { type: "boolean", label: "Boolean" },
    { type: "color", label: "Color" },
    { type: "number", label: "Number" },
    { type: "string", label: "String" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "image", label: "Image" },
    { type: "link", label: "Link" },
    { type: "date", label: "Date" },
]

const getInitialSlugFieldColumnIndex = (context: PluginContext, slugFields: CollectionField[]): number => {
    if (context.type === "update" && context.slugFieldColumnIndex) {
        return context.slugFieldColumnIndex
    }

    return Number(slugFields[0]?.id ?? 0)
}

const getLastSyncedTime = (
    context: PluginContext,
    slugFieldColumnIndex: number,
    headerRow: string[]
): string | null => {
    if (context.type !== "update") return null

    // Always resync if the slug field changes
    if (context.slugFieldColumnIndex !== slugFieldColumnIndex) return null

    // Always resync if field config changes
    if (hasFieldConfigurationChanged(context.sheetHeaderRow, headerRow)) {
        return null
    }

    return context.lastSyncedTime
}

const inferFieldType = (cellValue: CellValue): CollectionFieldType => {
    if (typeof cellValue === "boolean") return "boolean"
    if (typeof cellValue === "number") return "number"

    if (typeof cellValue === "string") {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(cellValue)) return "date"

        if (/^#[0-9A-Fa-f]{6}$/.test(cellValue)) return "color"

        if (/\.(jpeg|jpg|gif|png)$/.test(cellValue)) return "image"

        if (/^(https?:\/\/)?([a-zA-Z0-9.-]+)\.([a-zA-Z]{2,6})([/\w .-]*)*\/?$/.test(cellValue)) return "link"

        if (/<[a-z][\s\S]*>/i.test(cellValue)) return "formattedText"
    }

    return "string"
}

const getFieldType = (context: PluginContext, columnIndex: number, cellValue?: CellValue): CollectionFieldType => {
    // Determine if the field type is already configured
    if ("collectionFields" in context) {
        const field = context.collectionFields?.find(field => Number(field.id) === columnIndex)
        return field?.type ?? "string"
    }

    // Otherwise, infer the field type from the cell value
    return cellValue ? inferFieldType(cellValue) : "string"
}

const createFieldConfig = (headerRow: HeaderRow, context: PluginContext, row?: Row): CollectionFieldConfig[] => {
    return headerRow.map((headerName, columnIndex) => ({
        field: {
            id: String(columnIndex),
            name: headerName,
            type: getFieldType(context, columnIndex, row?.[columnIndex]),
        } as CollectionField,
        originalFieldName: headerName,
    }))
}

const getFieldNameOverrides = (context: PluginContext): Record<string, string> => {
    const result: Record<string, string> = {}
    if (context.type !== "update") return result

    for (const field of context.collectionFields) {
        result[field.id] = field.name
    }

    return result
}

const getPossibleSlugFields = (
    fieldConfig: CollectionFieldConfig[],
    disabledFieldIds: Set<number>
): CollectionField[] => {
    return fieldConfig
        .filter(fieldConfig => fieldConfig.field?.type === "string")
        .map(fieldConfig => fieldConfig.field)
        .filter(isDefined)
        .filter(field => !disabledFieldIds.has(Number(field.id)))
}

interface Props {
    spreadsheetId: string
    sheetTitle: string
    headerRow: HeaderRow
    pluginContext: PluginContext
    onSubmit: (opts: SyncMutationOptions) => void
    isPending: boolean
    rows: Row[]
}

export function MapSheetFieldsPage({
    spreadsheetId,
    sheetTitle,
    headerRow,
    pluginContext,
    onSubmit,
    isPending,
    rows,
}: Props) {
    const { ref: scrollRef, inView: isAtBottom } = useInView({ threshold: 1 })

    const [fieldConfig, setFieldConfig] = useState<CollectionFieldConfig[]>(() =>
        createFieldConfig(headerRow, pluginContext, rows[0])
    )
    const [disabledFieldColumnIndexes, setDisabledFieldColumnIndexes] = useState(
        () => new Set<number>(pluginContext.type === "update" ? pluginContext.ignoredFieldColumnIndexes : [])
    )
    const slugFields = useMemo(
        () => getPossibleSlugFields(fieldConfig, disabledFieldColumnIndexes),
        [fieldConfig, disabledFieldColumnIndexes]
    )
    const [slugFieldColumnIndex, setSlugFieldColumnIndex] = useState<number>(() =>
        getInitialSlugFieldColumnIndex(pluginContext, slugFields)
    )
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(pluginContext)
    )

    const handleFieldToggle = (strKey: string) => {
        const key = Number(strKey)
        setDisabledFieldColumnIndexes(current => {
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

    const handleFieldTypeChange = (id: number, type: CollectionFieldType) => {
        setFieldConfig(current =>
            current.map(config => {
                if (config.field && Number(config.field.id) === id) {
                    return {
                        ...config,
                        field: {
                            ...config.field,
                            type,
                        } as CollectionField,
                        cases: [],
                    }
                }

                return config
            })
        )
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (isPending) return

        const allFields = fieldConfig
            .filter(fieldConfig => fieldConfig.field && !disabledFieldColumnIndexes.has(Number(fieldConfig.field.id)))
            .map(fieldConfig => fieldConfig.field)
            .filter(isDefined)
            .map(field => {
                if (fieldNameOverrides[field.id]) {
                    field.name = fieldNameOverrides[field.id]
                }

                return field
            })

        onSubmit({
            fields: allFields,
            spreadsheetId,
            sheetTitle,
            slugFieldColumnIndex,
            colFieldTypes: fieldConfig.map(fieldConfig => fieldConfig.field?.type ?? "string"),
            ignoredFieldColumnIndexes: Array.from(disabledFieldColumnIndexes),
            lastSyncedTime: getLastSyncedTime(pluginContext, slugFieldColumnIndex, headerRow),
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
                        value={slugFieldColumnIndex ?? ""}
                        onChange={e => setSlugFieldColumnIndex(Number(e.target.value))}
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
                {fieldConfig.map(fieldConfig => {
                    const isSlugField = slugFieldColumnIndex === Number(fieldConfig.field?.id)
                    const isDisabled = disabledFieldColumnIndexes.has(Number(fieldConfig.field?.id))

                    if (isSlugField) return null

                    return (
                        <Fragment key={fieldConfig.originalFieldName}>
                            <div
                                className={cx(
                                    "flex items-center gap-2.5 px-2 h-[30px] bg-tertiary rounded-md overflow-hidden cursor-pointer",
                                    {
                                        "opacity-50": isDisabled,
                                    }
                                )}
                                onClick={() => {
                                    if (fieldConfig.field) {
                                        handleFieldToggle(fieldConfig.field.id)
                                    }
                                }}
                            >
                                <input
                                    type="checkbox"
                                    disabled={!fieldConfig.field || isSlugField}
                                    checked={!isDisabled}
                                    className="flex-shrink-0 checked:!bg-sheets-green focus:ring-1 focus:ring-sheets-green"
                                    onClick={e => {
                                        e.stopPropagation()
                                        if (fieldConfig.field) {
                                            handleFieldToggle(fieldConfig.field.id)
                                        }
                                    }}
                                    onChange={() => {}}
                                />
                                <p className="text-primary truncate flex-grow min-w-0">
                                    {fieldConfig.originalFieldName}
                                </p>
                            </div>
                            <div
                                className={cx("flex items-center justify-center", {
                                    "opacity-50": isDisabled,
                                })}
                            >
                                <IconChevron />
                            </div>
                            <input
                                type="text"
                                className={cx("w-full", { "opacity-50": isDisabled })}
                                disabled={
                                    !fieldConfig.field || disabledFieldColumnIndexes.has(Number(fieldConfig.field.id))
                                }
                                placeholder={fieldConfig.originalFieldName}
                                value={
                                    !fieldConfig.field
                                        ? "Unsupported Field"
                                        : (fieldNameOverrides[fieldConfig.field.id] ?? "")
                                }
                                onChange={e => {
                                    assert(fieldConfig.field, "Expected field to be defined on fieldConfig")
                                    handleFieldNameChange(fieldConfig.field.id, e.target.value)
                                }}
                            />
                            <select
                                className={cx("w-full", { "opacity-50": isDisabled })}
                                disabled={
                                    !fieldConfig.field || disabledFieldColumnIndexes.has(Number(fieldConfig.field.id))
                                }
                                value={fieldConfig.field?.type}
                                onChange={e => {
                                    assert(fieldConfig.field, "Expected field to be defined on fieldConfig")
                                    handleFieldTypeChange(
                                        Number(fieldConfig.field.id),
                                        e.target.value as CollectionFieldType
                                    )
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
                {fieldConfig.length > 4 && !isAtBottom && (
                    <div className="flex-shrink-0 h-[45px] w-full block bg-gradient-to-b from-transparent to-white overflow-visible z-10 absolute left-0 bottom-[63px] dark:bg-[linear-gradient(180deg,rgba(18,18,18,0)_0%,rgb(17,17,17)_97.8%)]"></div>
                )}
                <div ref={scrollRef} className="h-0 w-0 bg-red-500 "></div>
            </div>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 border-t border-divider border-opacity-20 items-center max-w-full overflow-hidden">
                <Button variant="secondary" isPending={isPending} className="w-full">
                    {`Import from ${sheetTitle}`}
                </Button>
            </div>
        </form>
    )
}
