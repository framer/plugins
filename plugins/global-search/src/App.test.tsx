import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { App } from "./App"

describe("App", () => {
    it("should render search interface", () => {
        render(<App />)
        expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Search for anything in your Framer project/i)).toBeInTheDocument()
    })
})
