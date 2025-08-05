import { vi } from "vitest"

// Mock framer-plugin for tests
vi.mock("framer-plugin", () => ({
    framer: {
        showUI: vi.fn(),
    },
}))
