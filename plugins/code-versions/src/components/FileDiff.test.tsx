import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import FileDiff from "./FileDiff"

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
            expect(addedLineRow).toHaveClass("bg-green-50")
            expect(screen.getByText("+ 2")).toBeInTheDocument()
        })
    })

    describe("when lines are removed", () => {
        it("shows removed lines with red background", () => {
            const oldContent = "line1\nline2\nline3"
            const newContent = "line1\nline3"
            render(<FileDiff original={oldContent} revised={newContent} />)
            expect(screen.getByText("line2")).toBeInTheDocument()
            const removedLineRow = screen.getByText("line2").closest("tr")
            expect(removedLineRow).toHaveClass("bg-red-50")
            expect(screen.getByText("- 2")).toBeInTheDocument()
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
            expect(oldWord).toHaveClass("bg-red-200")
            expect(newWord).toHaveClass("bg-green-200")
            expect(falseWord).toHaveClass("bg-red-200")
            expect(trueWord).toHaveClass("bg-green-200")
        })
    })

    describe("when words are added to existing lines", () => {
        it("highlights only the added words", () => {
            const oldContent = "const name = 'John'"
            const newContent = "const name = 'John Doe'"
            render(<FileDiff original={oldContent} revised={newContent} />)
            const addedWord = screen.getByText("Doe")
            expect(addedWord).toBeInTheDocument()
            expect(addedWord.closest("mark")).toHaveClass("bg-green-200")
        })
    })

    describe("when words are removed from existing lines", () => {
        it("highlights only the removed words", () => {
            const oldContent = "const name = 'John Doe'"
            const newContent = "const name = 'John'"
            render(<FileDiff original={oldContent} revised={newContent} />)
            const removedWord = screen.getByText("Doe")
            expect(removedWord).toBeInTheDocument()
            expect(removedWord.closest("mark")).toHaveClass("bg-red-200")
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
            expect(screen.getByText("a").closest("mark")).toHaveClass("bg-red-200")
            expect(screen.getByText("b").closest("mark")).toHaveClass("bg-green-200")
        })
    })
})
