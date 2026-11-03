import { describe, expect, it } from "vitest"
import type { SheetCollectionFieldInput } from "./sheets"
import { getStoredColumnConfigs, orderFieldsByHeaderRow } from "./utils"

const headerRow = ["Name", "Status", "Status"]

const storedFields: SheetCollectionFieldInput[] = [
    { id: "Name", name: "Name", type: "string" },
    { id: "Status", name: "Status", type: "number" },
    { id: "Status 2", name: "Status 2", type: "boolean" },
]

describe("orderFieldsByHeaderRow", () => {
    it("keeps the field for each duplicate header", () => {
        const fields = orderFieldsByHeaderRow(headerRow, storedFields)

        expect(fields.map(field => field.id)).toEqual(["Name", "Status", "Status 2"])
    })

    it("follows the column order of the sheet", () => {
        const fields = orderFieldsByHeaderRow(["Status", "Name", "Status"], storedFields)

        expect(fields.map(field => field.id)).toEqual(["Status", "Name", "Status 2"])
    })
})

describe("getStoredColumnConfigs", () => {
    it("uses the stored config of each duplicate header", () => {
        expect(getStoredColumnConfigs(headerRow, storedFields, {})).toEqual([
            { type: "string" },
            { type: "number" },
            { type: "boolean" },
        ])
    })

    it("restores alt text assignments for a duplicate header", () => {
        const fields: SheetCollectionFieldInput[] = [
            { id: "Name", name: "Name", type: "string" },
            { id: "Image", name: "Image", type: "image" },
        ]

        expect(getStoredColumnConfigs(["Name", "Image", "Name"], fields, { "Name 2": "Image" })).toEqual([
            { type: "string" },
            { type: "image" },
            { type: "altText", imageColumnId: "Image" },
        ])
    })

    it("defaults unknown columns to string", () => {
        expect(getStoredColumnConfigs(["Name", "Notes"], storedFields, {})).toEqual([
            { type: "string" },
            { type: "string" },
        ])
    })
})
