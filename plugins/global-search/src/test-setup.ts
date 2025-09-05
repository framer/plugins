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
        getCodeFiles: vi.fn().mockResolvedValue([]),
        getCodeFile: vi.fn().mockResolvedValue(null),
        getProjectInfo: vi.fn().mockResolvedValue({
            id: "test-project-id",
            name: "Test Project",
        }),
    },
}))

// Mock requestIdleCallback for tests
Object.defineProperty(globalThis, "requestIdleCallback", {
    value: (callback: IdleRequestCallback, options?: IdleRequestOptions): number => {
        const mockDeadline: IdleDeadline = {
            didTimeout: false,
            timeRemaining: () => 50, // Always return sufficient time for tests
        }
        return setTimeout(() => {
            callback(mockDeadline)
        }, options?.timeout ?? 0) as unknown as number
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
