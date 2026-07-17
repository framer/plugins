import cx from "classnames"
import { framer, type MenuItem } from "framer-plugin"
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

const getFieldTypeLabel = (field: SheetCollectionFieldInput, allFields: SheetCollectionFieldInput[]): string => {
    if (isAltTextColumn(field)) {
        const imageField = allFields.find(candidate => candidate.id === field.imageFieldId)
        return imageField ? `Alt Text → ${imageField.name}` : "Alt Text"
    }

    return fieldTypeOptions.find(option => option.type === field.type)?.label ?? field.type
}

interface Props {
    field: SheetCollectionFieldInput
    fields: SheetCollectionFieldInput[]
    isDisabled: boolean
    disabledFieldIds: Set<string>
    onFieldTypeChange: (id: string, type: VirtualFieldType, imageFieldId?: string) => void
}

export function FieldTypeSelectField({ field, fields, isDisabled, disabledFieldIds, onFieldTypeChange }: Props) {
    const imageField = fields.find(candidate => candidate.id === field.imageFieldId)

    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        const availableImageFields = fields.filter(
            candidate => candidate.type === "image" && candidate.id !== field.id && !disabledFieldIds.has(candidate.id)
        )
        const { left, bottom, width } = event.currentTarget.getBoundingClientRect()

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
                enabled: availableImageFields.length > 0,
                submenu: availableImageFields.map(candidate => ({
                    label: candidate.name,
                    checked: isAltTextColumn(field) && field.imageFieldId === candidate.id,
                    onAction: () => {
                        onFieldTypeChange(field.id, "altText", candidate.id)
                    },
                })),
            },
        ]

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
            title={getFieldTypeLabel(field, fields)}
            onClick={handleMenuOpen}
        >
            {isAltTextColumn(field) ? (
                <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="flex shrink-0 items-center gap-1">
                        Alt Text
                        <IconChevron />
                    </span>
                    <span className="truncate">{imageField?.name ?? "Image"}</span>
                </span>
            ) : (
                <span className="min-w-0 flex-1 truncate">{getFieldTypeLabel(field, fields)}</span>
            )}
            <span className="shrink-0 text-content">
                <IconChevronDown />
            </span>
        </button>
    )
}
