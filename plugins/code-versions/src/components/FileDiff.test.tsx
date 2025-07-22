import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FileDiff } from "./FileDiff"

const ADDED_CLASS_NAME = "bg-diff-add-bg/10"
const REMOVED_CLASS_NAME = "bg-diff-remove-bg/10"
const ADDED_ROW_CLASS_NAME = "to-diff-add-bg/10"
const REMOVED_ROW_CLASS_NAME = "to-diff-remove/10"

describe("FileDiff", () => {
    describe("when content is identical", () => {
        it("shows unchanged content without highlighting", () => {
            const content = "function test() {\n  return true;\n}"
            render(<FileDiff original={content} revised={content} />)
            const table = screen.getByRole("table")
            expect(table).toBeInTheDocument()
            expect(screen.getByText("function test() {")).toBeInTheDocument()
            expect(screen.getByText("return true;")).toBeInTheDocument()
            expect(screen.getByText("}")).toBeInTheDocument()
            expect(screen.queryByRole("mark")).not.toBeInTheDocument()
        })
    })

    describe("when lines are added", () => {
        it("shows added lines with green background", () => {
            const oldContent = "line1\nline3"
            const newContent = "line1\nline2\nline3"
            render(<FileDiff original={oldContent} revised={newContent} />)
            expect(screen.getByText("line2")).toBeInTheDocument()
            const addedLineRow = screen.getByText("line2").closest("tr")
            expect(addedLineRow).toHaveClass(ADDED_ROW_CLASS_NAME)
            expect(screen.getByText("+2")).toBeInTheDocument()
        })
    })

    describe("when lines are removed", () => {
        it("shows removed lines with red background", () => {
            const oldContent = "line1\nline2\nline3"
            const newContent = "line1\nline3"
            render(<FileDiff original={oldContent} revised={newContent} />)
            expect(screen.getByText("line2")).toBeInTheDocument()
            const removedLineRow = screen.getByText("line2").closest("tr")
            expect(removedLineRow).toHaveClass(REMOVED_ROW_CLASS_NAME)
            expect(screen.getByText("-2")).toBeInTheDocument()
        })
    })

    describe("when lines are changed", () => {
        it("shows both old and new versions with highlighting", () => {
            const oldContent = "function old() {\n  return false;\n}"
            const newContent = "function new() {\n  return true;\n}"
            render(<FileDiff original={oldContent} revised={newContent} />)
            expect(screen.getByText("old")).toBeInTheDocument()
            expect(screen.getByText("new")).toBeInTheDocument()
            expect(screen.getByText("false")).toBeInTheDocument()
            expect(screen.getByText("true")).toBeInTheDocument()
            const oldWord = screen.getByText("old").closest("mark")
            const newWord = screen.getByText("new").closest("mark")
            const falseWord = screen.getByText("false").closest("mark")
            const trueWord = screen.getByText("true").closest("mark")
            expect(oldWord).toHaveClass(REMOVED_CLASS_NAME)
            expect(newWord).toHaveClass(ADDED_CLASS_NAME)
            expect(falseWord).toHaveClass(REMOVED_CLASS_NAME)
            expect(trueWord).toHaveClass(ADDED_CLASS_NAME)
        })
    })

    describe("when words are added to existing lines", () => {
        it("highlights only the added words", () => {
            const oldContent = "const name = 'John'"
            const newContent = "const name = 'John Doe'"
            render(<FileDiff original={oldContent} revised={newContent} />)
            const addedWord = screen.getByText("Doe")
            expect(addedWord).toBeInTheDocument()
            expect(addedWord.closest("mark")).toHaveClass(ADDED_CLASS_NAME)
        })
    })

    describe("when words are removed from existing lines", () => {
        it("highlights only the removed words", () => {
            const oldContent = "const name = 'John Doe'"
            const newContent = "const name = 'John'"
            render(<FileDiff original={oldContent} revised={newContent} />)
            const removedWord = screen.getByText("Doe")
            expect(removedWord).toBeInTheDocument()
            expect(removedWord.closest("mark")).toHaveClass(REMOVED_CLASS_NAME)
        })
    })

    describe("edge cases", () => {
        it("handles empty content gracefully", () => {
            render(<FileDiff original="" revised="" />)
            expect(screen.getByRole("table")).toBeInTheDocument()
        })

        it("handles single character changes", () => {
            const oldContent = "a"
            const newContent = "b"
            render(<FileDiff original={oldContent} revised={newContent} />)
            expect(screen.getByText("a")).toBeInTheDocument()
            expect(screen.getByText("b")).toBeInTheDocument()
            expect(screen.getByText("a").closest("mark")).toHaveClass(REMOVED_CLASS_NAME)
            expect(screen.getByText("b").closest("mark")).toHaveClass(ADDED_CLASS_NAME)
        })
    })

    describe("FileDiff integration edge cases", () => {
        it("renders correct borders for a simple remove", () => {
            render(<FileDiff original={"a\nb\nc"} revised={"a\nc"} />)
            const removedRow = screen.getByText("b").closest("tr")
            const removedTd = removedRow?.querySelector("td")
            expect(removedTd).toHaveClass("border-t")
            expect(removedTd).toHaveClass("border-b")
        })

        it("renders correct borders for a simple add", () => {
            render(<FileDiff original={"a\nc"} revised={"a\nb\nc"} />)
            const addedRow = screen.getByText("b").closest("tr")
            const addedTd = addedRow?.querySelector("td")
            expect(addedTd).toHaveClass("border-t")
            expect(addedTd).toHaveClass("border-b")
        })

        it("renders correct borders for remove followed by change", () => {
            render(<FileDiff original={"a\nb\nc\nd"} revised={"a\nB\nd"} />)
            const changeRow = screen.getByText("b").closest("tr")
            const changeRemoveTd = changeRow?.querySelector("td")
            expect(changeRemoveTd).toHaveClass("border-t")
            const removeRow = screen.getByText("c").closest("tr")
            const removeTd = removeRow?.querySelector("td")
            expect(removeTd).not.toHaveClass("border-t")
        })

        it("renders correct borders for change followed by add", () => {
            render(<FileDiff original={"a\nb"} revised={"a\nB\nc\nd"} />)
            const addRow = screen.getByText("c").closest("tr")
            const addTd = addRow?.querySelector("td")
            expect(addTd).not.toHaveClass("border-t")
        })
    })
})
