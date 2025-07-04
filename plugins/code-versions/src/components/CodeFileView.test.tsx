import { render, screen } from "@testing-library/react"
import { CodeFile } from "framer-plugin"
import { describe, expect, it, vi } from "vitest"
import { LoadingState } from "../hooks/useCodeFileVersions"
import CodeFileView from "./CodeFileView"

vi.mock("framer-plugin", () => ({
    framer: {},
    useIsAllowedTo: vi.fn(() => true),
}))

describe("CodeFileView loading states", () => {
    const baseState = {
        codeFile: {
            id: "file-1",
            name: "testfile.txt",
            path: "/testfile.txt",
            content: "",
            versionId: "1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            size: 0,
            type: "text/plain",
            exports: [],
            setFileContent: () => {},
            rename: () => {},
            delete: () => {},
            getContent: () => "",
            save: () => Promise.resolve(),
            remove: () => {},
            getVersions: () => [],
            showProgressOnInstances: () => {},
            hideProgressOnInstances: () => {},
            getInstanceIds: () => [],
            removeProgressFromInstances: () => {},
            lint: () => Promise.resolve([]),
            typecheck: () => Promise.resolve([]),
        } as unknown as CodeFile,
        selectedVersionId: "1",
        versions: [],
        versionsLoading: LoadingState.Initial,
        contentLoading: LoadingState.Initial,
        versionContent: "",
        restoreLoading: LoadingState.Initial,
        restoreCompleted: false,
        errors: {},
    }

    it("does not render FileDiff when content is loading", () => {
        render(<CodeFileView state={baseState} selectVersion={vi.fn()} restoreVersion={vi.fn()} />)
        expect(screen.queryByTestId("file-diff")).toBeNull()
    })
})
