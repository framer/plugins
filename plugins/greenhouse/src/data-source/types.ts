import type { FieldData } from "framer-plugin"

export type FieldType =
    | "string"
    | "number"
    | "boolean"
    | "color"
    | "formattedText"
    | "image"
    | "file"
    | "link"
    | "date"
    | "enum"
    | "collectionReference"
    | "multiCollectionReference"

type ConditionalField<T extends FieldData["type"]> = T extends "multiCollectionReference" | "collectionReference"
    ? { collection: DataSource }
    : { collection?: DataSource }

export type Field = {
    id: string
    name: string
    type: FieldType
} & ConditionalField<FieldData["type"]>

export type DataSource = {
    id: string
    fields: Field[]
    idField: Field
    slugField: Field
}
