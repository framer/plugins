import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"

import { afterEach, vi } from "vitest"

// Mock framer-plugin for tests
vi.mock("framer-plugin", () => ({
    framer: {
        showUI: vi.fn(),
        subscribeToSelection: vi.fn(),
        setMenu: vi.fn(),
        getNodesWithType: vi.fn().mockReturnValue([]),
        getCollections: vi.fn().mockReturnValue([]),
    },
}))

// Mock requestIdleCallback for tests
Object.defineProperty(globalThis, "requestIdleCallback", {
    value: (callback: IdleRequestCallback, options?: IdleRequestOptions): number => {
        return setTimeout(callback, options?.timeout ?? 0) as unknown as number
    },
    writable: true,
})

Object.defineProperty(globalThis, "cancelIdleCallback", {
    value: (handle: number): void => {
        clearTimeout(handle)
    },
    writable: true,
})

afterEach(() => {
    cleanup()
})
