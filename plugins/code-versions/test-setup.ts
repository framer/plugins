import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"

import { afterEach, vi } from "vitest"

// Mock framer-plugin for tests
vi.mock("framer-plugin", () => ({
    framer: {
        showUI: vi.fn(),
    },
}))

afterEach(() => {
    cleanup()
})
