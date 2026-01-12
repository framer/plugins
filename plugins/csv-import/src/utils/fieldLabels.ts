import type { VirtualFieldType } from "./virtualTypes"

export const labelByFieldType: Record<VirtualFieldType, string> = {
    boolean: "Toggle",
    date: "Date",
    datetime: "DateTime",
    number: "Number",
    formattedText: "Formatted Text",
    color: "Color",
    enum: "Option",
    file: "File",
    image: "Image",
    link: "Link",
    string: "Plain Text",
    collectionReference: "Reference",
    multiCollectionReference: "Multi-Reference",
    array: "Gallery",
    divider: "Divider",
    unsupported: "Unsupported",
}
