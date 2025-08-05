import { beforeEach, describe, expect, it, vi } from "vitest"
import { getFieldDataEntryForFieldSchema } from "./data"
import type { PossibleField } from "./fields"

describe("getFieldDataEntryForFieldSchema", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const createEmailField = (): PossibleField => ({
        id: "email_field",
        name: "Email",
        type: "link",
        userEditable: true,
        airtableType: "email",
    })

    const createPhoneField = (): PossibleField => ({
        id: "phone_field",
        name: "Phone",
        type: "link",
        userEditable: true,
        airtableType: "phoneNumber",
    })

    describe("Email field processing", () => {
        it("should add mailto: prefix to email without prefix", () => {
            const result = getFieldDataEntryForFieldSchema(createEmailField(), "user@example.com")

            expect(result).toEqual({
                value: "mailto:user@example.com",
                type: "link",
            })
        })

        it("should preserve single mailto: prefix", () => {
            const result = getFieldDataEntryForFieldSchema(createEmailField(), "mailto:user@example.com")

            expect(result).toEqual({
                value: "mailto:user@example.com",
                type: "link",
            })
        })

        it("should normalize multiple mailto: prefixes to one", () => {
            const result = getFieldDataEntryForFieldSchema(createEmailField(), "mailto:mailto:user@example.com")

            expect(result).toEqual({
                value: "mailto:user@example.com",
                type: "link",
            })
        })

        it("should handle case insensitive mailto: prefix", () => {
            const result = getFieldDataEntryForFieldSchema(createEmailField(), "MAILTO:user@example.com")

            expect(result).toEqual({
                value: "mailto:user@example.com",
                type: "link",
            })
        })

        it("should detect email by regex when field type is not email", () => {
            const linkField: PossibleField = {
                id: "link_field",
                name: "Link",
                type: "link",
                userEditable: true,
                airtableType: "url", // Not an email field type
            }

            const result = getFieldDataEntryForFieldSchema(linkField, "test@domain.co.uk")

            expect(result).toEqual({
                value: "mailto:test@domain.co.uk",
                type: "link",
            })
        })
    })

    describe("Phone field processing", () => {
        it("should add tel: prefix to phone without prefix", () => {
            const result = getFieldDataEntryForFieldSchema(createPhoneField(), "+1234567890")

            expect(result).toEqual({
                value: "tel:+1234567890",
                type: "link",
            })
        })

        it("should preserve single tel: prefix", () => {
            const result = getFieldDataEntryForFieldSchema(createPhoneField(), "tel:+1234567890")

            expect(result).toEqual({
                value: "tel:+1234567890",
                type: "link",
            })
        })

        it("should normalize multiple tel: prefixes to one", () => {
            const result = getFieldDataEntryForFieldSchema(createPhoneField(), "tel:tel:+1234567890")

            expect(result).toEqual({
                value: "tel:+1234567890",
                type: "link",
            })
        })

        it("should handle case insensitive tel: prefix", () => {
            const result = getFieldDataEntryForFieldSchema(createPhoneField(), "TEL:+1234567890")

            expect(result).toEqual({
                value: "tel:+1234567890",
                type: "link",
            })
        })

        it("should detect phone by regex when field type is not phoneNumber", () => {
            const linkField: PossibleField = {
                id: "link_field",
                name: "Link",
                type: "link",
                userEditable: true,
                airtableType: "url", // Not a phone field type
            }

            const result = getFieldDataEntryForFieldSchema(linkField, "1234567890")

            expect(result).toEqual({
                value: "tel:1234567890",
                type: "link",
            })
        })
    })
})
