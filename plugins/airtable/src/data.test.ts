import { beforeEach, describe, expect, it, vi } from "vitest"
import { getFieldDataEntryForFieldSchema } from "./data"
import type { PossibleField } from "./fields"

describe("getFieldDataEntryForFieldSchema", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const createEmailField = () =>
        ({
            id: "email_field",
            name: "Email",
            type: "link",
            airtableType: "email",
        }) as const satisfies PossibleField

    const createPhoneField = () =>
        ({
            id: "phone_field",
            name: "Phone",
            type: "link",
            airtableType: "phoneNumber",
        }) as const satisfies PossibleField

    describe("Email field processing", () => {
        it.each<[PossibleField, string]>([
            [createEmailField(), "user@example.com"],
            [createEmailField(), "mailto:user@example.com"],
            [createEmailField(), "mailto:mailto:user@example.com"],
            [createEmailField(), "MAILTO:user@example.com"],
            [
                {
                    id: "link_field",
                    name: "Link",
                    type: "link",
                    airtableType: "url", // Not an email field type
                },
                "user@example.com",
            ],
        ])("%s -> %s", (field, input) => {
            const result = getFieldDataEntryForFieldSchema(field, input)

            expect(result).toEqual({
                value: "mailto:user@example.com",
                type: "link",
            })
        })
    })

    describe("Phone field processing", () => {
        it.each<[PossibleField, string]>([
            [createPhoneField(), "+1234567890"],
            [createPhoneField(), "tel:+1234567890"],
            [createPhoneField(), "tel:tel:+1234567890"],
            [createPhoneField(), "TEL:+1234567890"],
            [
                {
                    id: "link_field",
                    name: "Link",
                    type: "link",
                    airtableType: "url", // Not a phone field type
                },
                "+1234567890",
            ],
        ])("%s -> %s", (field, input) => {
            const result = getFieldDataEntryForFieldSchema(field, input)

            expect(result).toEqual({
                value: "tel:+1234567890",
                type: "link",
            })
        })
    })
})
