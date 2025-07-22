import type {
    BlockObjectResponse,
    CodeBlockObjectResponse,
    RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints"
import { assert } from "./utils"

export function richTextToHtml(texts: RichTextItemResponse[]) {
    return texts
        .map(({ plain_text, annotations, href }) => {
            let html = plain_text

            // Apply formatting based on annotations
            if (annotations.bold) {
                html = `<strong>${html}</strong>`
            }
            if (annotations.italic) {
                html = `<em>${html}</em>`
            }
            if (annotations.strikethrough) {
                html = `<del>${html}</del>`
            }
            if (annotations.underline) {
                html = `<u>${html}</u>`
            }

            if (annotations.code) {
                html = `<code>${html}</code>`
            }

            if (annotations.color !== "default") {
                const color = annotations.color.replace("_", "")
                html = `<span style="color:${color}">${html}</span>`
            }

            if (href) {
                html = `<a href="${href}" target="_blank" rel="noopener noreferrer">${html}</a>`
            }

            return html
        })
        .join("")
}

const YOUTUBE_ID_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))(?<videoId>[^?&]+)/iu
export function blocksToHtml(blocks: BlockObjectResponse[]) {
    let htmlContent = ""

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        assert(block)

        switch (block.type) {
            case "paragraph":
                htmlContent += `<p>${richTextToHtml(block.paragraph.rich_text)}</p>`
                break
            case "heading_1":
                htmlContent += `<h1>${richTextToHtml(block.heading_1.rich_text)}</h1>`
                break
            case "heading_2":
                htmlContent += `<h2>${richTextToHtml(block.heading_2.rich_text)}</h2>`
                break
            case "heading_3":
                htmlContent += `<h3>${richTextToHtml(block.heading_3.rich_text)}</h3>`
                break
            case "divider":
                htmlContent += "<hr >"
                break
            case "quote":
                htmlContent += `<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`
                break
            case "image":
                switch (block.image.type) {
                    case "external":
                        htmlContent += `<img src="${block.image.external.url}" alt="${block.image.caption[0]?.plain_text ?? ""}" />`
                        break
                    case "file":
                        htmlContent += `<img src="${block.image.file.url}" alt="${block.image.caption[0]?.plain_text ?? ""}" />`
                        break
                }
                break
            case "bulleted_list_item":
            case "numbered_list_item": {
                const tag = block.type === "bulleted_list_item" ? "ul" : "ol"

                // Start the list if it's the first item of its type or the previous item isn't a list of the same type
                if (i === 0 || blocks.at(i - 1)?.type !== block.type) htmlContent += `<${tag}>`

                if (block.type === "bulleted_list_item") {
                    htmlContent += `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>`
                } else {
                    // Add the list item
                    htmlContent += `<li>${richTextToHtml(block.numbered_list_item.rich_text)}</li>`
                }

                // If next block is not the same type, close the list
                if (i === blocks.length - 1 || blocks.at(i + 1)?.type !== block.type) {
                    htmlContent += `</${tag}>`
                }
                break
            }
            case "code": {
                const language = CODE_LANGUAGE_MAP[block.code.language]
                htmlContent += `<pre data-language="${language ?? "Markdown"}"><code>${richTextToHtml(block.code.rich_text)}</code></pre>`
                break
            }
            case "table":
                htmlContent += `<table>`
                break
            case "table_row":
                if (blocks[i - 1]?.type === "table") {
                    htmlContent += `<thead><tr>`
                    block.table_row.cells.forEach(cell => {
                        htmlContent += `<th>${richTextToHtml(cell)}</th>`
                    })
                    htmlContent += `</tr></thead><tbody>`
                } else {
                    htmlContent += `<tr>`
                    block.table_row.cells.forEach(cell => {
                        htmlContent += `<td>${richTextToHtml(cell)}</td>`
                    })
                    htmlContent += `</tr>`
                }

                if (blocks[i + 1]?.type !== "table_row") {
                    htmlContent += `</tbody></table>`
                }
                break
            case "video": {
                if (block.video.type !== "external") {
                    break
                }

                const videoUrl = block.video.external.url
                const videoId = YOUTUBE_ID_REGEX.exec(videoUrl)?.groups?.videoId
                if (videoId) {
                    // Framer styles and modifies the YouTube iframe automatically
                    htmlContent += `<iframe src="https://www.youtube.com/embed/${videoId}"></iframe>`
                }
                break
            }
            default:
                // TODO: More block types can be added here!
                break
        }
    }

    return htmlContent
}

type NotionCodeLanguage = CodeBlockObjectResponse["code"]["language"]
const CODE_LANGUAGE_MAP: Record<NotionCodeLanguage, string | null> = {
    abap: null,
    agda: null,
    arduino: null,
    "ascii art": null,
    assembly: null,
    bash: "Shell",
    basic: null,
    bnf: null,
    c: "C",
    "c#": "C#",
    "c++": "C++",
    clojure: null,
    coffeescript: null,
    coq: null,
    css: "CSS",
    dart: null,
    dhall: null,
    diff: null,
    docker: null,
    ebnf: null,
    elixir: null,
    elm: null,
    erlang: null,
    "f#": null,
    flow: null,
    fortran: null,
    gherkin: null,
    glsl: null,
    go: "Go",
    graphql: null,
    groovy: null,
    haskell: "Haskell",
    hcl: null,
    html: "HTML",
    idris: null,
    java: "Java",
    javascript: "JavaScript",
    json: "JavaScript",
    julia: "Julia",
    kotlin: "Kotlin",
    latex: null,
    less: "Less",
    lisp: null,
    livescript: null,
    "llvm ir": null,
    lua: "Lua",
    makefile: null,
    markdown: "Markdown",
    markup: null,
    matlab: "MATLAB",
    mathematica: null,
    mermaid: null,
    nix: null,
    "notion formula": null,
    "objective-c": "Objective-C",
    ocaml: null,
    pascal: null,
    perl: "Perl",
    php: "PHP",
    "plain text": null,
    powershell: null,
    prolog: null,
    protobuf: null,
    purescript: null,
    python: "Python",
    r: null,
    racket: null,
    reason: null,
    ruby: "Ruby",
    rust: "Rust",
    sass: null,
    scala: "Scala",
    scheme: null,
    scss: "SCSS",
    shell: "Shell",
    smalltalk: null,
    solidity: null,
    sql: "SQL",
    swift: "Swift",
    toml: null,
    typescript: "TypeScript",
    "vb.net": null,
    verilog: null,
    vhdl: null,
    "visual basic": null,
    webassembly: null,
    xml: null,
    yaml: "YAML",
    "java/c/c++/c#": null,
}
