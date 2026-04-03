import cx from "classnames"
import { framer, useIsAllowedTo } from "framer-plugin"
import { Fragment, useMemo, useState } from "react"
import { CheckboxTextfield } from "../components/CheckboxTextField"
import { getEnumCasesForColumn } from "../enumCases"
import { IconChevron } from "../components/Icons"
import type { CellValue, HeaderRow, PluginContext, PluginContextUpdate, Row, SyncMutationOptions } from "../sheets"
import { generateUniqueNames, syncMethods } from "../utils"

type FieldType = SyncMutationOptions["colFieldTypes"][number]

interface FieldTypeOption {
    type: FieldType
    label: string
}

type EditableField = SyncMutationOptions["fields"][number]

const fieldTypeOptions: FieldTypeOption[] = [
    { type: "string", label: "Plain Text" },
    { type: "formattedText", label: "Formatted Text" },
    { type: "date", label: "Date" },
    { type: "dateTime", label: "Date & Time" },
    { type: "link", label: "Link" },
    { type: "image", label: "Image" },
    { type: "color", label: "Color" },
    { type: "boolean", label: "Toggle" },
    { type: "number", label: "Number" },
    { type: "enum", label: "Option" },
    { type: "file", label: "File" },
]

function isFieldType(value: string): value is FieldType {
    return fieldTypeOptions.some(option => option.type === value)
}

function getConfiguredField(
    context: PluginContext,
    columnId: string
): PluginContextUpdate["collectionFields"][number] | undefined {
    if (!isUpdateContext(context)) return undefined

    return context.collectionFields.find(field => field.id === columnId)
}

function isUpdateContext(context: PluginContext): context is PluginContextUpdate {
    return context.type === "update"
}

const getInitialSlugColumn = (context: PluginContext, slugFields: EditableField[]): string => {
    if (isUpdateContext(context) && context.slugColumn) {
        return context.slugColumn
    }

    const firstSlugField = slugFields[0]
    return firstSlugField?.id ?? ""
}

const getLastSyncedTime = (context: PluginContext, slugColumn: string): string | null => {
    if (context.type !== "update") return null

    // Always resync if the slug field changes
    if (context.slugColumn !== slugColumn) return null

    // Always resync if field config changes
    if (context.hasChangedFields) {
        return null
    }

    return context.lastSyncedTime
}

const inferFieldType = (cellValue: CellValue): FieldType => {
    if (typeof cellValue === "boolean") return "boolean"
    if (typeof cellValue === "number") return "number"

    if (typeof cellValue === "string") {
        const cellValueTrimmed = cellValue.trim()
        const cellValueLowered = cellValueTrimmed.toLowerCase()

        // If the cell value contains a newline, it's probably a formatted text field
        if (cellValueLowered.includes("\n")) return "formattedText"
        if (/<[a-z][\s\S]*>/.test(cellValueLowered)) return "formattedText"

        // Check if the string is an ISO date
        // Accepts formats like 2023-01-01, 2023-01-01T12:34:56Z, 2023-01-01T12:34:56.789+02:00, etc.
        if (/^\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-Zz]*)?$/.test(cellValueTrimmed) && !isNaN(Date.parse(cellValueTrimmed))) {
            // Date-only values (YYYY-MM-DD) map to date.
            if (/^\d{4}-\d{2}-\d{2}$/.test(cellValueTrimmed)) {
                return "date"
            }
            // ISO values with an explicit time component map to dateTime.
            if (/[Tt ]\d{2}:\d{2}/.test(cellValueTrimmed)) {
                return "dateTime"
            }
            return "date"
        }

        // Detect hex, rgb(), and rgba() CSS color formats
        if (
            /^#[0-9a-f]{6}$/.test(cellValueLowered) ||
            /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:\d*\.?\d+|\d+%))?\s*\)$/i.test(cellValueTrimmed)
        ) {
            return "color"
        }

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

const getFieldType = (context: PluginContext, columnId: string, cellValue?: CellValue): FieldType => {
    // Determine if the field type is already configured
    const configuredField = getConfiguredField(context, columnId)
    if (configuredField) return configuredField.type

    // Otherwise, infer the field type from the cell value
    return cellValue ? inferFieldType(cellValue) : "string"
}

const createFieldConfig = (
    headerRow: HeaderRow,
    uniqueColumnNames: string[],
    context: PluginContext,
    row?: Row
): EditableField[] => {
    const fields: EditableField[] = []

    for (const [columnIndex] of headerRow.entries()) {
        const sanitizedName = uniqueColumnNames[columnIndex]
        if (!sanitizedName) continue
        const configuredField = getConfiguredField(context, sanitizedName)
        const initialType: FieldType = getFieldType(context, sanitizedName, row?.[columnIndex])

        fields.push({
            id: sanitizedName,
            name: sanitizedName,
            type: initialType,
            cases: configuredField?.cases,
        })
    }

    return fields
}

const getFieldNameOverrides = (context: PluginContext): Record<string, string> => {
    const result: Record<string, string> = {}
    if (!isUpdateContext(context)) return result

    for (const field of context.collectionFields) {
        result[field.id] = field.name
    }

    return result
}

const getPossibleSlugFields = (fieldConfig: EditableField[]): EditableField[] => {
    return fieldConfig.filter(field => field.type === "string")
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
    const uniqueColumnNames = useMemo(() => generateUniqueNames(headerRow), [headerRow])
    const [fieldConfig, setFieldConfig] = useState<EditableField[]>(() =>
        createFieldConfig(headerRow, uniqueColumnNames, pluginContext, rows[0])
    )
    const [disabledColumns, setDisabledColumns] = useState<Set<string>>(
        () => new Set<string>(isUpdateContext(pluginContext) ? pluginContext.ignoredColumns : [])
    )
    const slugFields = useMemo(() => getPossibleSlugFields(fieldConfig), [fieldConfig])
    const [slugColumn, setSlugColumn] = useState<string>(() => getInitialSlugColumn(pluginContext, slugFields))
    const [fieldNameOverrides, setFieldNameOverrides] = useState<Record<string, string>>(() =>
        getFieldNameOverrides(pluginContext)
    )

    const handleFieldToggle = (id: string) => {
        setDisabledColumns(current => {
            const nextSet = new Set(current)
            if (nextSet.has(id)) {
                nextSet.delete(id)
            } else {
                nextSet.add(id)
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

    const handleFieldTypeChange = (id: string, type: FieldType) => {
        setFieldConfig(current => {
            const nextFields: EditableField[] = []

            for (const field of current) {
                nextFields.push(field.id === id ? { ...field, type } : field)
            }

            return nextFields
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isPending) return

        const allFields: SyncMutationOptions["fields"] = []
        for (const field of fieldConfig) {
            if (disabledColumns.has(field.id)) continue

            const result: EditableField = { ...field }
            const maybeOverride = fieldNameOverrides[result.id]
            if (maybeOverride) {
                result.name = maybeOverride
            }

            if (result.type === "enum") {
                const colIndex = uniqueColumnNames.indexOf(result.id)
                if (colIndex !== -1) {
                    result.cases = getEnumCasesForColumn(rows, colIndex)
                }

                if (!result.cases || result.cases.length === 0) {
                    framer.notify(
                        `"${result.name}" needs at least one non-empty value before it can be imported as an Option field.`,
                        {
                            variant: "error",
                            durationMs: 5000,
                        }
                    )
                    return
                }
            }

            allFields.push(result)
        }

        const colFieldTypes: SyncMutationOptions["colFieldTypes"] = []
        for (const field of fieldConfig) {
            colFieldTypes.push(field.type)
        }

        await framer.setCloseWarning("Synchronization in progress. Closing will cancel the sync.")

        const submitOptions: SyncMutationOptions = {
            fields: allFields,
            spreadsheetId,
            sheetTitle,
            colFieldTypes,
            ignoredColumns: Array.from(disabledColumns),
            slugColumn,
            lastSyncedTime: getLastSyncedTime(pluginContext, slugColumn),
        }

        onSubmit(submitOptions)
    }

    const isAllowedToManage = useIsAllowedTo("ManagedCollection.setFields", ...syncMethods)

    return (
        <main className="select-none w-full min-h-full">
            <form onSubmit={e => void handleSubmit(e)} className="col gap-[15px] h-full text-tertiary min-h-full">
                <div className="h-px border-b border-divider sticky top-0" />
                <div className="flex flex-col gap-[10px] w-full">
                    <label htmlFor="collectionName">Slug Field</label>
                    <select
                        className={cx("w-full", !isAllowedToManage && "opacity-50")}
                        value={slugColumn}
                        onChange={e => {
                            setSlugColumn(e.target.value)
                        }}
                        required
                        disabled={!isAllowedToManage}
                        title={isAllowedToManage ? undefined : "Insufficient permissions"}
                    >
                        {slugFields.map(field => (
                            <option key={field.id} value={field.id}>
                                {field.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols items-center grid-cols-field-picker gap-[10px] overflow-hidden pt-[5px] pb-[10px] mb-auto min-h-fit shrink-0">
                    <span className="col-span-2">Column</span>
                    <span>Type</span>
                    <span>Name</span>
                    {fieldConfig.map((field, i) => {
                        const isDisabled = disabledColumns.has(field.id)

                        return (
                            <Fragment key={i}>
                                <CheckboxTextfield
                                    value={field.name}
                                    darken={isDisabled || !isAllowedToManage}
                                    checked={!isDisabled}
                                    onChange={() => {
                                        handleFieldToggle(field.id)
                                    }}
                                    disabled={!isAllowedToManage}
                                />
                                <div className="flex items-center justify-center">
                                    <IconChevron />
                                </div>
                                <select
                                    className={cx("w-full", (isDisabled || !isAllowedToManage) && "opacity-50")}
                                    disabled={isDisabled || !isAllowedToManage}
                                    value={field.type}
                                    onChange={e => {
                                        if (isFieldType(e.target.value)) {
                                            handleFieldTypeChange(field.id, e.target.value)
                                        }
                                    }}
                                    title={isAllowedToManage ? undefined : "Insufficient permissions"}
                                >
                                    {fieldTypeOptions.map(({ type, label }) => (
                                        <option key={type} value={type}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    className={cx("w-full", (isDisabled || !isAllowedToManage) && "opacity-50")}
                                    disabled={isDisabled || !isAllowedToManage}
                                    placeholder={field.name}
                                    value={fieldNameOverrides[field.id] ?? ""}
                                    onChange={e => {
                                        handleFieldNameChange(field.id, e.target.value)
                                    }}
                                />
                            </Fragment>
                        )
                    })}
                </div>
                <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-[15px] border-t border-divider border-opacity-20 items-center max-w-full">
                    <div className="scroll-fade"></div>
                    <button
                        disabled={!isAllowedToManage}
                        title={isAllowedToManage ? undefined : "Insufficient permissions"}
                        className="whitespace-nowrap inline-block"
                    >
                        {isPending ? <div className="framer-spinner" /> : `Import from ${sheetTitle}`}
                    </button>
                </div>
            </form>
        </main>
    )
}
