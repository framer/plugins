import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./skills.ts", () => ({
    installSkills: vi.fn().mockResolvedValue(undefined),
}))

const mockAta = vi.fn<(code: string) => Promise<Map<string, string>>>().mockResolvedValue(new Map())
vi.mock("@typescript/ata", () => ({
    setupTypeAcquisition: vi.fn(() => mockAta),
}))

const mockFetch =
    vi.fn<(input: string | URL | Request) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>>()
vi.stubGlobal("fetch", mockFetch)

import { Installer } from "./installer.ts"

let tmpDir: string

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cl-installer-"))
    mockAta.mockClear()
    mockFetch.mockReset()
    mockFetch.mockImplementation(async input => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url

        if (url === "https://registry.npmjs.org/framer/latest") {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    version: "3.0.2",
                    peerDependencies: {
                        "framer-motion": "^12.34.3",
                        react: "^18.2.0",
                    },
                }),
            }
        }

        throw new Error(`Unexpected fetch: ${url}`)
    })
})

afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
})

describe("Installer", () => {
    describe("version pinning", () => {
        it("pins core imports using framer's manifest", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            await vi.waitFor(() => {
                expect(mockAta).toHaveBeenCalled()
            })

            const coreCall = mockAta.mock.calls[0][0]
            expect(coreCall).toContain(`import "framer"; // types: 3.0.2`)
            expect(coreCall).toContain(`import "framer-motion"; // types: 12.34.3`)
            expect(coreCall).toContain(`import "react"; // types: 18.2.0`)
            expect(coreCall).toContain(`import "react-dom"; // types: 18.2.0`)
        })

        it("falls back to default pins when framer metadata fetch fails", async () => {
            mockFetch.mockRejectedValueOnce(new Error("network down"))

            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            await vi.waitFor(() => {
                expect(mockAta).toHaveBeenCalled()
            })

            const coreCall = mockAta.mock.calls[0][0]
            expect(coreCall).toContain(`import "framer";`)
            expect(coreCall).toContain(`import "framer-motion"; // types: 12.34.3`)
            expect(coreCall).toContain(`import "react"; // types: 18.2.0`)
            expect(coreCall).toContain(`import "react-dom"; // types: 18.2.0`)
        })
    })

    describe("project scaffolding", () => {
        it("creates tsconfig.json", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            const tsconfig = JSON.parse(await fs.readFile(path.join(tmpDir, "tsconfig.json"), "utf-8"))
            expect(tsconfig.compilerOptions.jsx).toBe("react-jsx")
            expect(tsconfig.compilerOptions.moduleResolution).toBe("bundler")
        })

        it("creates package.json", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, "package.json"), "utf-8"))
            expect(pkg.private).toBe(true)
        })

        it("creates .prettierrc", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            const config = JSON.parse(await fs.readFile(path.join(tmpDir, ".prettierrc"), "utf-8"))
            expect(config.tabWidth).toBe(4)
            expect(config.semi).toBe(false)
        })

        it("creates framer-modules.d.ts", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            const content = await fs.readFile(path.join(tmpDir, "framer-modules.d.ts"), "utf-8")
            expect(content).toContain('declare module "https://framer.com/m/*"')
        })

        it("creates .gitignore", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            const content = await fs.readFile(path.join(tmpDir, ".gitignore"), "utf-8")
            expect(content).toContain("node_modules/")
        })

        it("does not overwrite existing files", async () => {
            await fs.writeFile(path.join(tmpDir, "tsconfig.json"), '{"custom": true}')

            const installer = new Installer({ projectDir: tmpDir })
            await installer.initialize()

            const tsconfig = JSON.parse(await fs.readFile(path.join(tmpDir, "tsconfig.json"), "utf-8"))
            expect(tsconfig.custom).toBe(true)
        })
    })

    describe("processFiles()", () => {
        async function initAndClearAta(installer: InstanceType<typeof Installer>) {
            await installer.initialize()
            await vi.waitFor(() => {
                expect(mockAta).toHaveBeenCalled()
            })
            await new Promise(resolve => setTimeout(resolve, 200))
            mockAta.mockClear()
        }

        it("ignores JSON files", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await initAndClearAta(installer)

            await installer.processFiles([{ name: "data.json", content: '{"key": "value"}' }])

            expect(mockAta).not.toHaveBeenCalled()
        })

        it("ignores empty content", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await initAndClearAta(installer)

            await installer.processFiles([{ name: "component.tsx", content: "" }])

            expect(mockAta).not.toHaveBeenCalled()
        })

        it("deduplicates identical import sets", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await initAndClearAta(installer)

            const code = `import { motion } from "framer-motion"`
            await installer.processFiles([{ name: "a.tsx", content: code }])
            await installer.processFiles([{ name: "b.tsx", content: code }])

            expect(mockAta).toHaveBeenCalledTimes(1)
        })

        it("pins React runtime imports when components reference them", async () => {
            const installer = new Installer({ projectDir: tmpDir })
            await initAndClearAta(installer)

            await installer.processFiles([
                {
                    name: "component.tsx",
                    content: `import React from "react"\nimport { createRoot } from "react-dom/client"`,
                },
            ])

            const processedCall = mockAta.mock.calls[0][0]
            expect(processedCall).toContain(`import "react"; // types: 18.2.0`)
            expect(processedCall).toContain(`import "react-dom"; // types: 18.2.0`)
        })

        it("updates package.json dependencies in package-manager mode", async () => {
            const requestDependencyVersions = vi.fn(async () => ({
                "@types/react": "18.2.0",
                "@types/react-dom": "18.2.0",
                framer: "3.0.2",
                "framer-motion": "12.34.3",
                lodash: "4.17.21",
                react: "18.2.0",
                "react-dom": "18.2.0",
            }))
            const installer = new Installer({
                projectDir: tmpDir,
                npmStrategy: "package-manager",
                requestDependencyVersions,
            })

            await installer.initialize()
            mockAta.mockClear()

            const files = [{ name: "component.tsx", content: `import debounce from "lodash/debounce"` }]
            await installer.processFiles(files)

            const packagePath = path.join(tmpDir, "package.json")
            const firstPackageJson = await fs.readFile(packagePath, "utf-8")
            const pkg = JSON.parse(firstPackageJson)
            expect(mockAta).not.toHaveBeenCalled()
            expect(pkg.dependencies).toMatchObject({
                framer: "3.0.2",
                "framer-motion": "12.34.3",
                lodash: "4.17.21",
                react: "18.2.0",
                "react-dom": "18.2.0",
            })
            expect(pkg.devDependencies).toMatchObject({
                "@types/react": "18.2.0",
                "@types/react-dom": "18.2.0",
            })

            await installer.processFiles(files)

            expect(await fs.readFile(packagePath, "utf-8")).toBe(firstPackageJson)
        })
    })
})
