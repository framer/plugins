import { CheckboxTextfield } from "@/components/CheckboxTextField"
import { IconChevron } from "@/components/Icons"
import { ScrollFadeContainer } from "@/components/ScrollFadeContainer"
import { assert } from "@/utils"
import { ManagedCollectionField } from "framer-plugin"
import { Fragment, useMemo } from "react"
import cx from "classnames"

export interface ManagedCollectionFieldConfig {
    field: ManagedCollectionField | null | undefined
    originalFieldName: string
}

interface FieldMapperProps {
    collectionFieldConfig: ManagedCollectionFieldConfig[]
    fieldNameOverrides: Record<string, string>
    isFieldSelected: (fieldId: string) => boolean
    onFieldToggle: (fieldId: string) => void
    onFieldNameChange: (fieldId: string, value: string) => void
    fromLabel?: string
    toLabel?: string
    className?: string
    height?: number
}

const getInitialSortedFields = (
    fields: ManagedCollectionFieldConfig[],
    isFieldSelected: (fieldId: string) => boolean
): ManagedCollectionFieldConfig[] => {
    return [...fields].sort((a, b) => {
        const aIsSelected = a.field && isFieldSelected(a.field.id)
        const bIsSelected = b.field && isFieldSelected(b.field.id)

        // Sort based on whether the fields are selected
        if (aIsSelected && !bIsSelected) return -1
        if (!aIsSelected && bIsSelected) return 1

        // Sort by whether they are supported fields
        if (a.field !== null && a.field !== undefined && (b.field === null || b.field === undefined)) return -1
        if ((a.field === null || a.field === undefined) && b.field !== null && b.field !== undefined) return 1

        // Sort by whether they are null (missing reference)
        if (a.field === null && b.field !== null) return -1
        if (a.field !== null && b.field === null) return 1

        // Sort by whether they are undefined (unsupported fields)
        if (a.field === undefined && b.field !== undefined) return 1
        if (a.field !== undefined && b.field === undefined) return -1

        return 0
    })
}

export const FieldMapper = ({
    collectionFieldConfig,
    fieldNameOverrides,
    isFieldSelected,
    onFieldToggle,
    onFieldNameChange,
    fromLabel = "Column",
    toLabel = "Field",
    height,
    className,
}: FieldMapperProps) => {
    // We only want to sort on initial render
    const sortedCollectionFieldConfig = useMemo(
        () => getInitialSortedFields(collectionFieldConfig, isFieldSelected),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [collectionFieldConfig]
    )

    return (
        <ScrollFadeContainer height={height || 280} className={className}>
            <div className="grid grid-cols-fieldPicker items-center gap-2.5">
                <span className="col-span-2 h-[30px] flex items-end text-tertiary">{fromLabel}</span>
                <span className="h-[30px] flex items-end text-tertiary">{toLabel}</span>
                {sortedCollectionFieldConfig.map((fieldConfig, i) => {
                    const isUnsupported = !fieldConfig.field
                    const isSelected = fieldConfig.field ? isFieldSelected(fieldConfig.field.id) : false

                    return (
                        <Fragment key={i}>
                            <CheckboxTextfield
                                value={fieldConfig.originalFieldName}
                                disabled={!fieldConfig.field}
                                checked={!!fieldConfig.field && isSelected}
                                onChange={() => {
                                    assert(fieldConfig.field)
                                    onFieldToggle(fieldConfig.field.id)
                                }}
                            />
                            <div
                                className={cx("flex items-center justify-center", {
                                    "opacity-50": isUnsupported,
                                })}
                            >
                                <IconChevron />
                            </div>
                            <input
                                type="text"
                                className={cx("w-full", { "opacity-50": isUnsupported })}
                                disabled={!fieldConfig.field || !isSelected}
                                placeholder={fieldConfig.originalFieldName}
                                value={
                                    fieldConfig.field === undefined
                                        ? "Unsupported Field"
                                        : fieldConfig.field === null
                                          ? "Missing Reference"
                                          : (fieldNameOverrides[fieldConfig.field.id] ?? "")
                                }
                                onChange={e => {
                                    assert(fieldConfig.field)
                                    onFieldNameChange(fieldConfig.field.id, e.target.value)
                                }}
                            />
                        </Fragment>
                    )
                })}
            </div>
        </ScrollFadeContainer>
    )
}
