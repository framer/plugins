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

    const createPhoneField = () =>
        ({
            id: "phone_field",
            name: "Phone",
            type: "link",
            airtableType: "phoneNumber",
        }) as const satisfies PossibleField

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

    const createFormattedTextField = () =>
        ({
            id: "formatted_text_field",
            name: "Formatted Text",
            type: "formattedText",
            airtableType: "multilineText",
        }) as const satisfies PossibleField

    describe("Formatted text field processing", () => {
        it("converts nested formatting in lists", () => {
            const field = createFormattedTextField()
            const input = `
**Key Features at a Glance**
<p><br></p>
- **Performance**: Optimized for speed and efficiency.
- **Compatibility**: Works seamlessly across all major platforms.
- **Benefits**: Easy setup, no configuration required, automatic updates. **Limitations**: Limited customization options, requires internet connection.
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)

            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><strong>Key Features at a Glance</strong></p>
              <p><br></p>
              <ul><li><strong>Performance</strong>: Optimized for speed and efficiency.</li><li><strong>Compatibility</strong>: Works seamlessly across all major platforms.</li><li><strong>Benefits</strong>: Easy setup, no configuration required, automatic updates. <strong>Limitations</strong>: Limited customization options, requires internet connection.</li></ul></p>"
            `)
        })

        it("handles mixed inline formatting with bold, italic, and code", () => {
            const field = createFormattedTextField()
            const input = `
***Bold and italic*** combined
**Bold with _nested italic_ inside**
*Italic with **nested bold** text*
\`code\` mixed with **bold** and *italic*
- ***List item*** with \`inline code\`
- Normal text **bold _italic_ bold** normal
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><em><strong>Bold and italic</strong></em> combined<br><strong>Bold with <em>nested italic</em> inside</strong><br><em>Italic with <strong>nested bold</strong> text</em><br><code>code</code> mixed with <strong>bold</strong> and <em>italic</em></p>
              <ul>
              <li><em><strong>List item</strong></em> with <code>inline code</code></li>
              <li>Normal text <strong>bold <em>italic</em> bold</strong> normal</li>
              </ul>
              </p>"
            `)
        })

        it("handles empty elements and excessive spacing", () => {
            const field = createFormattedTextField()
            const input = `
**Bold**   with   spaces
<p></p>
<br><br><br>
- Item with trailing spaces    
-  
- **Bold** item after empty item
****
__ __
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><strong>Bold</strong>   with   spaces</p>
              <p></p>
              <br><br><br>
              <ul><li>Item with trailing spaces    </li><li>- <strong>Bold</strong> item after empty item</li></ul>
              <strong></strong>
              __ __</p>"
            `)
        })

        it("handles deeply nested lists with mixed formatting", () => {
            const field = createFormattedTextField()
            const input = `
- **Level 1** with *italic*
  - Level 2 with \`code\`
    - ***Level 3*** bold italic
  - Back to **level 2**
- Another **level 1**
  - Nested with **bold _and italic_**
    - Triple nested ***all bold italic***
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><ul>
              <li><strong>Level 1</strong> with <em>italic</em><ul>
              <li>Level 2 with <code>code</code><ul>
              <li><em><strong>Level 3</strong></em> bold italic</li>
              </ul>
              </li>
              <li>Back to <strong>level 2</strong></li>
              </ul>
              </li>
              <li>Another <strong>level 1</strong><ul>
              <li>Nested with <strong>bold <em>and italic</em></strong><ul>
              <li>Triple nested <em><strong>all bold italic</strong></em></li>
              </ul>
              </li>
              </ul>
              </li>
              </ul>
              </p>"
            `)
        })

        it("handles mixed HTML tags and markdown", () => {
            const field = createFormattedTextField()
            const input = `
<strong>HTML bold</strong> and **markdown bold**
<em>HTML italic</em> and *markdown italic*
<p>Paragraph with **markdown** inside</p>
<ul><li>HTML list</li></ul>
- Markdown list
<br/>Line break<br/>
**Bold** <span>span tag</span> *italic*
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><strong>HTML bold</strong> and <strong>markdown bold</strong><br><em>HTML italic</em> and <em>markdown italic</em></p>
              <p>Paragraph with <strong>markdown</strong> inside</p>
              <ul><li>HTML list</li><li>Markdown list</li></ul>
              <br/>Line break<br/>
              <strong>Bold</strong> <span>span tag</span> <em>italic</em></p>"
            `)
        })

        it("handles special characters and escaping", () => {
            const field = createFormattedTextField()
            const input = `
**Special \`characters\`** like & < > " '
Escaped \\*not italic\\* and \\**not bold\\**
URLs with **formatting**: https://example.com/path?query=**test**
Email with *emphasis*: user@*example*.com
Math-like: 2 * 3 = 6 and 2 ** 3 = 8
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><strong>Special <code>characters</code></strong> like &amp; &lt; &gt; &quot; &#39;<br>Escaped <em>not italic</em> and <em><em>not bold</em></em><br>URLs with <strong>formatting</strong>: <a href="https://example.com/path?query=<strong>test">https://example.com/path?query=</strong>test</a><strong><br>Email with <em>emphasis</em>: user@<em>example</em>.com<br>Math-like: 2 * 3 = 6 and 2 </strong> 3 = 8</p>
              </p>"
            `)
        })

        it("handles edge cases with consecutive formatting marks", () => {
            const field = createFormattedTextField()
            const input = `
******Six asterisks******
____Four underscores____
**__Bold and underline__**
__**Underline and bold**__
- ****Empty bold****
- ** **Spaces in bold** **
- *Italic with ** incomplete bold*
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><strong><strong><strong>Six asterisks</strong></strong></strong><br><strong><strong>Four underscores</strong></strong><br><strong><strong>Bold and underline</strong></strong><br><strong><strong>Underline and bold</strong></strong></p>
              <ul>
              <li><strong><strong>Empty bold</strong></strong></li>
              <li><strong> <strong>Spaces in bold</strong> </strong></li>
              <li><em>Italic with <em></em> incomplete bold</em></li>
              </ul>
              </p>"
            `)
        })

        it("handles complex nested structures with multiple paragraph breaks", () => {
            const field = createFormattedTextField()
            const input = `
# **Bold Header**
<p><br></p>
## *Italic Subheader*

Paragraph with **bold**, *italic*, and \`code\`.

<p></p>

- First item with **bold text**
  <p><br></p>
  - Nested with break above
  
- Second item after blank line
  - **Bold** and *italic* and ***both***
    - Deep nesting with \`inline code\` and **formatting**

<br/><br/>

Final paragraph with ***all*** _the_ **formatting** \`types\` combined.
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><h1><strong>Bold Header</strong></h1>
              <p><br></p>
              <h2><em>Italic Subheader</em></h2></p><p><p>Paragraph with <strong>bold</strong>, <em>italic</em>, and <code>code</code>.</p>
              <p></p></p><p><ul>
              <li><p>First item with <strong>bold text</strong></p>
              <p><br></p>
              <ul><li>Nested with break above</li></ul>
              </li>
              <li><p>Second item after blank line</p>
              <ul>
              <li><strong>Bold</strong> and <em>italic</em> and <em><strong>both</strong></em><ul>
              <li>Deep nesting with <code>inline code</code> and <strong>formatting</strong></li>
              </ul>
              </li>
              </ul>
              </li>
              </ul>
              <p><br/><br/></p>
              <p>Final paragraph with <em><strong>all</strong></em> <em>the</em> <strong>formatting</strong> <code>types</code> combined.</p>
              </p>"
            `)
        })

        it("handles links within formatted text", () => {
            const field = createFormattedTextField()
            const input = `
**Bold [link](https://example.com) text**
*Italic with [another link](https://test.com)*
[**Bold link text**](https://bold.com)
[*Italic link*](https://italic.com)
- List with [**formatted** link](https://list.com)
- **Bold** item with [normal link](https://normal.com)
`.trim()

            const result = getFieldDataEntryForFieldSchema(field, input)
            expect(result?.type).toEqual("formattedText")
            expect(result?.value).toMatchInlineSnapshot(`
              "<p><p><strong>Bold <a href="https://example.com">link</a> text</strong><br><em>Italic with <a href="https://test.com">another link</a></em><br><a href="https://bold.com"><strong>Bold link text</strong></a><br><a href="https://italic.com"><em>Italic link</em></a></p>
              <ul>
              <li>List with <a href="https://list.com"><strong>formatted</strong> link</a></li>
              <li><strong>Bold</strong> item with <a href="https://normal.com">normal link</a></li>
              </ul>
              </p>"
            `)
        })
    })
})
