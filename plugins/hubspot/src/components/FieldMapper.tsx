import cx from "classnames"
import { type ManagedCollectionFieldInput } from "framer-plugin"
import { Fragment, useMemo, useRef } from "react"
import { assert } from "../utils"
import { CheckboxTextfield } from "./CheckboxTextField"
import { IconChevron } from "./Icons"
import { ScrollFadeContainer } from "./ScrollFadeContainer"

export interface ManagedCollectionFieldConfig {
    field: ManagedCollectionFieldInput | null
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
    disabled: boolean
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

        // Then sort by whether they are supported fields
        if (a.field && !b.field) return -1
        if (!a.field && b.field) return 1

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
    disabled,
}: FieldMapperProps) => {
    // This is a way to tell React that this isn't a reactive dependency
    const isFieldSelectedRef = useRef(isFieldSelected)
    isFieldSelectedRef.current = isFieldSelected

    // We only want to sort on initial render, to keep it stable
    const sortedCollectionFieldConfig = useMemo(
        () => getInitialSortedFields(collectionFieldConfig, isFieldSelectedRef.current),
        [collectionFieldConfig]
    )

    return (
        <ScrollFadeContainer height={height ?? 280} className={className}>
            <div className="grid grid-cols-field-picker items-center gap-2.5">
                <span className="col-span-2 h-[30px] flex items-end text-tertiary">{fromLabel}</span>
                <span className="h-[30px] flex items-end text-tertiary">{toLabel}</span>
                {sortedCollectionFieldConfig.map((fieldConfig, i) => {
                    const isUnsupported = !fieldConfig.field
                    const isSelected = fieldConfig.field ? isFieldSelected(fieldConfig.field.id) : false

                    return (
                        <Fragment key={i}>
                            <CheckboxTextfield
                                value={fieldConfig.originalFieldName}
                                disabled={!fieldConfig.field || disabled}
                                checked={!!fieldConfig.field && isSelected}
                                onChange={() => {
                                    assert(fieldConfig.field)
                                    onFieldToggle(fieldConfig.field.id)
                                }}
                            />
                            <div
                                className={cx("flex items-center justify-center", {
                                    "opacity-50": isUnsupported || disabled,
                                })}
                            >
                                <IconChevron />
                            </div>
                            <input
                                type="text"
                                className={cx("w-full", { "opacity-50": isUnsupported || disabled })}
                                disabled={!fieldConfig.field || !isSelected || disabled}
                                placeholder={fieldConfig.originalFieldName}
                                value={
                                    !fieldConfig.field
                                        ? "Unsupported Field"
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
