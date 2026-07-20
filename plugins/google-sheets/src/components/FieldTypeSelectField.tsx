import cx from "classnames"
import { framer, type MenuItem } from "framer-plugin"
import React, { useMemo } from "react"
import { isAltTextColumn, type SheetCollectionFieldInput, type VirtualFieldType } from "../sheets"
import { IconChevron, IconChevronDown } from "./Icons"

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

const contextMenuOffset = 4

interface Props {
    field: SheetCollectionFieldInput
    fields: SheetCollectionFieldInput[]
    isDisabled: boolean
    disabledFieldIds: Set<string>
    onFieldTypeChange: (id: string, type: VirtualFieldType, imageColumnId?: string) => void
}

export function FieldTypeSelectField({ field, fields, isDisabled, disabledFieldIds, onFieldTypeChange }: Props) {
    const imageColumn = fields.find(candidate => candidate.id === field.imageColumnId)

    const fieldTypeLabel = useMemo(() => {
        if (isAltTextColumn(field)) {
            return imageColumn ? `Alt Text → ${imageColumn.name}` : "Alt Text"
        }

        return fieldTypeOptions.find(option => option.type === field.type)?.label ?? field.type
    }, [field, imageColumn])

    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        const assignedImageColumnIds = new Set(fields.filter(isAltTextColumn).map(candidate => candidate.imageColumnId))

        const imageFields = fields.filter(
            candidate => candidate.type === "image" && candidate.id !== field.id && !disabledFieldIds.has(candidate.id)
        )
        const canAssignImageField = (candidate: SheetCollectionFieldInput) =>
            !assignedImageColumnIds.has(candidate.id) || candidate.id === field.imageColumnId

        const items: MenuItem[] = [
            ...fieldTypeOptions.map(({ type, label }) => ({
                label,
                checked: field.type === type,
                onAction: () => {
                    onFieldTypeChange(field.id, type)
                },
            })),
            {
                label: "Alt Text",
                checked: isAltTextColumn(field),
                enabled: imageFields.some(canAssignImageField),
                submenu: imageFields.map(candidate => ({
                    label: candidate.name,
                    checked: isAltTextColumn(field) && field.imageColumnId === candidate.id,
                    enabled: canAssignImageField(candidate),
                    onAction: () => {
                        onFieldTypeChange(field.id, "altText", candidate.id)
                    },
                })),
            },
        ]

        const { left, bottom, width } = event.currentTarget.getBoundingClientRect()
        void framer.showContextMenu(items, {
            location: {
                x: left + width - contextMenuOffset,
                y: bottom + contextMenuOffset,
            },
            placement: "bottom-left",
            width,
        })
    }

    return (
        <button
            type="button"
            className={cx("flex w-full min-w-0 items-center gap-1 text-left", isDisabled && "opacity-50")}
            disabled={isDisabled}
            title={fieldTypeLabel}
            onClick={handleMenuOpen}
        >
            {isAltTextColumn(field) ? (
                <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="flex shrink-0 items-center gap-1">
                        Alt Text
                        <IconChevron />
                    </span>
                    <span className="truncate">{imageColumn?.name ?? "Image"}</span>
                </span>
            ) : (
                <span className="min-w-0 flex-1 truncate">{fieldTypeLabel}</span>
            )}
            <span className="shrink-0 text-content">
                <IconChevronDown />
            </span>
        </button>
    )
}
