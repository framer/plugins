import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { App } from "./App"

describe("App", () => {
    it("should render", () => {
        render(<App />)
        expect(screen.getByText(/Welcome!/gi)).toBeInTheDocument()
    })
})
