import cx from "classnames"
import { framer, type MenuItem, useIsAllowedTo } from "framer-plugin"
import { Fragment, useMemo, useState } from "react"
import { CheckboxTextfield } from "../components/CheckboxTextField"
import { IconChevron, IconChevronDown } from "../components/Icons"
import type {
    CellValue,
    HeaderRow,
    PluginContext,
    Row,
    SheetCollectionFieldInput,
    SheetColumnConfig,
    SyncMutationOptions,
    VirtualFieldType,
} from "../sheets"
import { generateUniqueNames, isDefined, syncMethods } from "../utils"

interface FieldTypeOption {
    type: VirtualFieldType
    label: string
}

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

const getInitialSlugColumn = (context: PluginContext, slugFields: SheetCollectionFieldInput[]): string => {
    if (context.type === "update" && context.slugColumn) {
        return context.slugColumn
    }

    return slugFields[0]?.id ?? ""
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

const inferFieldType = (cellValue: CellValue): VirtualFieldType => {
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

const getColumnConfig = (context: PluginContext, columnId: string, cellValue?: CellValue): SheetColumnConfig => {
    if (context.type === "update" && columnId in context.altTextAssignments) {
        return { type: "altText", imageFieldId: context.altTextAssignments[columnId] }
    }

    // Determine if the field type is already configured
    if ("collectionFields" in context) {
        const field = context.collectionFields.find(field => field.id === columnId)
        return { type: field?.type ?? "string" }
    }

    // Otherwise, infer the field type from the cell value
    return { type: cellValue ? inferFieldType(cellValue) : "string" }
}

const createFieldConfig = (
    headerRow: HeaderRow,
    uniqueColumnNames: string[],
    context: PluginContext,
    row?: Row
): SheetCollectionFieldInput[] => {
    return headerRow
        .map((_, columnIndex) => {
            const sanitizedName = uniqueColumnNames[columnIndex]
            if (!sanitizedName) return null

            const { type, imageFieldId } = getColumnConfig(context, sanitizedName, row?.[columnIndex])

            return {
                id: sanitizedName,
                name: sanitizedName,
                type,
                imageFieldId,
            } as SheetCollectionFieldInput
        })
        .filter(isDefined)
}

const getFieldNameOverrides = (context: PluginContext): Record<string, string> => {
    const result: Record<string, string> = {}
    if (context.type !== "update") return result

    for (const field of context.collectionFields) {
        result[field.id] = field.name
    }

    return result
}

const getPossibleSlugFields = (fieldConfig: SheetCollectionFieldInput[]): SheetCollectionFieldInput[] => {
    return fieldConfig.filter(field => field.type === "string")
}

const getFieldTypeLabel = (field: SheetCollectionFieldInput, allFields: SheetCollectionFieldInput[]): string => {
    if (field.type === "altText") {
        const imageField = allFields.find(f => f.id === field.imageFieldId)
        return imageField ? `Alt Text → ${imageField.name}` : "Alt Text"
    }

    return fieldTypeOptions.find(option => option.type === field.type)?.label ?? field.type
}

const getAltTextImageField = (field: SheetCollectionFieldInput, allFields: SheetCollectionFieldInput[]) => {
    return allFields.find(candidate => candidate.id === field.imageFieldId)
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
    const [fieldConfig, setFieldConfig] = useState<SheetCollectionFieldInput[]>(() =>
        createFieldConfig(headerRow, uniqueColumnNames, pluginContext, rows[0])
    )
    const [disabledColumns, setDisabledColumns] = useState(
        () => new Set<string>(pluginContext.type === "update" ? pluginContext.ignoredColumns : [])
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

    const handleFieldTypeChange = (id: string, type: VirtualFieldType, imageFieldId?: string) => {
        setFieldConfig(current =>
            current.map(field => {
                if (field.id === id) {
                    return {
                        ...field,
                        type,
                        imageFieldId: type === "altText" ? imageFieldId : undefined,
                    } as SheetCollectionFieldInput
                }
                return field
            })
        )
    }

    const handleFieldTypeMenuOpen = (field: SheetCollectionFieldInput, e: React.MouseEvent<HTMLButtonElement>) => {
        const imageFields = fieldConfig.filter(
            f => f.type === "image" && f.id !== field.id && !disabledColumns.has(f.id)
        )
        const { left, bottom, width } = e.currentTarget.getBoundingClientRect()

        const items: MenuItem[] = [
            ...fieldTypeOptions.map(({ type, label }) => ({
                label,
                checked: field.type === type,
                onAction: () => {
                    handleFieldTypeChange(field.id, type)
                },
            })),
            {
                label: "Alt Text",
                checked: field.type === "altText",
                enabled: imageFields.length > 0,
                submenu: imageFields.map(imgField => ({
                    label: imgField.name,
                    checked: field.type === "altText" && field.imageFieldId === imgField.id,
                    onAction: () => {
                        handleFieldTypeChange(field.id, "altText", imgField.id)
                    },
                })),
            },
        ]

        const locationX = left + width - 4;
        const locationY = bottom + 4;

        void framer.showContextMenu(items, {
            location: { x: locationX, y: locationY },
            placement: "bottom-left",
            width,
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isPending) return

        const allFields = fieldConfig
            // Alt text columns are virtual: they never become their own CMS field.
            .filter(field => !disabledColumns.has(field.id) && field.type !== "altText")
            .map(field => {
                const maybeOverride = fieldNameOverrides[field.id]
                if (maybeOverride) {
                    field.name = maybeOverride
                }

                return field
            })

        await framer.setCloseWarning("Synchronization in progress. Closing will cancel the sync.")

        onSubmit({
            fields: allFields,
            spreadsheetId,
            sheetTitle,
            columnConfigs: fieldConfig.map(field => ({ type: field.type, imageFieldId: field.imageFieldId })),
            ignoredColumns: Array.from(disabledColumns),
            slugColumn,
            lastSyncedTime: getLastSyncedTime(pluginContext, slugColumn),
            configureFields: true,
        })
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
                                <button
                                    type="button"
                                    className={cx(
                                        "flex w-full min-w-0 items-center gap-1 text-left",
                                        (isDisabled || !isAllowedToManage) && "opacity-50"
                                    )}
                                    disabled={isDisabled || !isAllowedToManage}
                                    title={
                                        isAllowedToManage
                                            ? getFieldTypeLabel(field, fieldConfig)
                                            : "Insufficient permissions"
                                    }
                                    onClick={e => {
                                        handleFieldTypeMenuOpen(field, e)
                                    }}
                                >
                                    {field.type === "altText" ? (
                                        <span className="flex min-w-0 flex-1 items-center gap-1">
                                            <span className="flex shrink-0 items-center gap-1">
                                                Alt Text
                                                <IconChevron />
                                            </span>
                                            <span className="truncate">
                                                {getAltTextImageField(field, fieldConfig)?.name ?? "Image"}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="min-w-0 flex-1 truncate">
                                            {getFieldTypeLabel(field, fieldConfig)}
                                        </span>
                                    )}
                                    <span className="shrink-0 text-content">
                                        <IconChevronDown />
                                    </span>
                                </button>
                                {field.type !== "altText" ? (
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
                                ) : (
                                    <div />
                                )}
                            </Fragment>
                        )
                    })}
                </div>
                <div className="sticky left-0 bottom-0 flex justify-between bg-primary py-[15px] border-t border-divider border-opacity-20 items-center max-w-full">
                    <div className="scroll-fade"></div>
                    <button
                        disabled={!isAllowedToManage}
                        title={isAllowedToManage ? undefined : "Insufficient permissions"}
                        className={cx("whitespace-nowrap", !isPending && "inline-block")}
                    >
                        {isPending ? <div className="framer-spinner" /> : `Import from ${sheetTitle}`}
                    </button>
                </div>
            </form>
        </main>
    )
}
