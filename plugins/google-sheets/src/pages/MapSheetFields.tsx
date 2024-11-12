import { Fragment, useMemo, useState } from "react"
import { CollectionField, ManagedCollectionField } from "framer-plugin"
import { useInView } from "react-intersection-observer"
import cx from "classnames"
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
import { CheckboxTextfield } from "../components/CheckboxTextField"

interface CollectionFieldConfig {
    field: ManagedCollectionField
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
        const cellValueLowered = cellValue.toLowerCase()

        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(cellValueLowered)) return "date"

        if (/^#[0-9a-f]{6}$/.test(cellValueLowered)) return "color"

        if (/<[a-z][\s\S]*>/i.test(cellValueLowered)) return "formattedText"

        try {
            new URL(cellValueLowered)

            if (/\.(gif|jpe?g|png|apng|svg|webp)$/i.test(cellValueLowered)) return "image"

            return "link"
        } catch (e) {
            return "string"
        }
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
        } as ManagedCollectionField,
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

const getPossibleSlugFields = (fieldConfig: CollectionFieldConfig[]): CollectionField[] => {
    return fieldConfig.filter(fieldConfig => fieldConfig.field?.type === "string").map(fieldConfig => fieldConfig.field)
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
    const slugFields = useMemo(() => getPossibleSlugFields(fieldConfig), [fieldConfig])
    const [disabledFieldColumnIndexes, setDisabledFieldColumnIndexes] = useState(
        () => new Set<number>(pluginContext.type === "update" ? pluginContext.ignoredFieldColumnIndexes : [])
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
                        } as ManagedCollectionField,
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
        <form onSubmit={handleSubmit} className="col gap-[15px] flex-1 text-tertiary">
            <div className="h-px border-b border-divider sticky top-0" />
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
            <div className="grid grid-cols items-center grid-cols-fieldPicker gap-2.5 mb-auto overflow-hidden mt-[10px]">
                <span className="col-span-2">Column</span>
                <span>Field</span>
                <span>Type</span>
                {fieldConfig.map((fieldConfig, i) => {
                    const isDisabled = disabledFieldColumnIndexes.has(Number(fieldConfig.field.id))

                    return (
                        <Fragment key={i}>
                            <CheckboxTextfield
                                value={fieldConfig.originalFieldName}
                                darken={isDisabled}
                                checked={!isDisabled}
                                onChange={() => handleFieldToggle(fieldConfig.field.id)}
                            />
                            <div className="flex items-center justify-center">
                                <IconChevron />
                            </div>
                            <input
                                type="text"
                                className={cx("w-full", {
                                    "opacity-50": isDisabled,
                                })}
                                disabled={isDisabled}
                                placeholder={fieldConfig.originalFieldName}
                                value={fieldNameOverrides[fieldConfig.field.id] ?? ""}
                                onChange={e => handleFieldNameChange(fieldConfig.field.id, e.target.value)}
                            />
                            <select
                                className="w-full"
                                disabled={isDisabled}
                                value={fieldConfig.field?.type}
                                onChange={e => {
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
                {fieldConfig.length > 4 && !isAtBottom && <div className="scroll-fade"></div>}
                <div ref={scrollRef} className="h-0 w-0 bg-red-500 "></div>
            </div>
            <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-4 border-t border-divider border-opacity-20 items-center max-w-full overflow-hidden">
                <Button variant="secondary" isLoading={isPending} className="w-full">
                    {`Import from ${sheetTitle}`}
                </Button>
            </div>
        </form>
    )
}
