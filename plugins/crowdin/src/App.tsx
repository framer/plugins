import { framer, type Locale, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { ProjectsGroups, Translations } from "@crowdin/crowdin-api-client"
import {
    createValuesBySourceFromXliff,
    ensureSourceFile,
    generateXliff,
    parseXliff,
    updateTranslation,
    uploadStorage,
} from "./xliff"

void framer.showUI({ width: 325, height: 377 })

interface Project {
    readonly id: number
    readonly name: string
}

interface CrowdinStorageResponse {
    data: {
        id: number
    }
}

// ----- App component -----
export function App({ activeLocale, locales }: { activeLocale: Locale | null; locales: readonly Locale[] }) {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")

    const [accessToken, setAccessToken] = useState<string>("")
    const [tokenInputValue, setTokenInputValue] = useState<string>("")
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)

    const validateAccessToken = useCallback((token: string, options?: { isInitialCheck?: boolean }) => {
        const isInitialCheck = options?.isInitialCheck ?? false
        setIsLoading(true)

        // Persist token
        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData("accessToken", token)
        }

        if (token) {
            const projectsGroupsApi = new ProjectsGroups({ token })
            projectsGroupsApi
                .withFetchAll()
                .listProjects()
                .then(response => {
                    // Only log in development
                    if (window.location.hostname === "localhost") {
                        console.log(response.data)
                    }
                    setAccessToken(token)
                    const projects = response.data.map(({ data }: { data: Project }) => ({
                        id: data.id,
                        name: data.name,
                    }))
                    setProjectList(projects)

                    // Auto-select if there's only one project
                    if (projects.length === 1 && projects[0]?.id) {
                        setProjectId(projects[0].id)
                        inputRef.current?.blur()
                    } else if (selectRef.current) {
                        setProjectId(0)
                        // Focus the select element after successful validation
                        selectRef.current.focus()
                    }
                })
                .catch((err: unknown) => {
                    console.error(err)
                    setProjectList([])
                    framer.notify("Invalid access token", { variant: "error" })
                    if (isInitialCheck) {
                        inputRef.current?.focus()
                    }
                })
                .finally(() => {
                    setIsLoading(false)
                })
        } else {
            setProjectList([])
            setProjectId(0)
            setAccessToken("")
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        async function loadStoredToken() {
            const storedToken = await framer.getPluginData("accessToken")
            if (storedToken) {
                setAccessToken(storedToken)
                setTokenInputValue(storedToken)
                validateAccessToken(storedToken, { isInitialCheck: true })
            } else {
                inputRef.current?.focus()
            }
        }
        void loadStoredToken()
    }, [validateAccessToken])

    // Set close warning when importing or exporting
    useEffect(() => {
        try {
            if (isImporting) {
                void framer.setCloseWarning("Import in progress. Closing will cancel the import.")
            } else if (isExporting) {
                void framer.setCloseWarning("Export in progress. Closing will cancel the export.")
            } else {
                void framer.setCloseWarning(false)
            }
        } catch (error) {
            console.error("Error setting close warning:", error)
        }
    }, [isImporting, isExporting])

    const handleTokenInputKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                validateAccessToken(tokenInputValue)
            }
        },
        [tokenInputValue, validateAccessToken]
    )

    const handleTokenInputBlur = useCallback(() => {
        validateAccessToken(tokenInputValue)
    }, [tokenInputValue, validateAccessToken])

    const createCrowdinClient = (token: string) => ({
        projects: new ProjectsGroups({ token }),
        translations: new Translations({ token }),
    })

    // ------------------ Import from Crowdin ------------------
    async function importFromCrowdIn() {
        if (isImporting) return

        if (!isAllowedToSetLocalizationData) {
            return framer.notify("You are not allowed to set localization data", {
                variant: "error",
            })
        } else if (!accessToken) {
            return framer.notify("Access Token is missing", {
                variant: "error",
            })
        } else if (!projectId) {
            return framer.notify("Project ID is missing", {
                variant: "error",
            })
        } else if (!activeLocale) {
            return framer.notify("Active locale is missing", {
                variant: "error",
            })
        }

        setIsImporting(true)
        const client = createCrowdinClient(accessToken)

        try {
            const exportRes = await client.translations.exportProjectTranslation(projectId, {
                targetLanguageId: activeLocale.code,
                format: "xliff",
            })
            const url = exportRes.data.url
            if (!url) {
                framer.notify("Crowdin export URL not found", {
                    variant: "error",
                })
                return
            }
            const resp = await fetch(url)
            const fileContent = await resp.text()
            const { xliff, targetLocale } = parseXliff(fileContent, locales)
            const valuesBySource = await createValuesBySourceFromXliff(xliff, targetLocale)

            const result = await framer.setLocalizationData({ valuesBySource })

            if (result.valuesBySource.errors.length > 0) {
                throw new Error(
                    result.valuesBySource.errors
                        .map(error => (error.sourceId ? `${error.error}: ${error.sourceId}` : error.error))
                        .join(", ")
                )
            }

            framer.notify(`Successfully imported localizations for ${targetLocale.name} (${activeLocale.code})`, {
                variant: "success",
                durationMs: 5000,
            })
        } catch (error) {
            console.error("Error importing from Crowdin:", error)
            framer.notify(`Import error: ${error instanceof Error ? error.message : "An unknown error occurred"}`, {
                variant: "error",
                durationMs: 10000,
            })
        } finally {
            setIsImporting(false)
        }
    }
    async function exportToCrowdIn() {
        if (isExporting) return

        if (!isAllowedToSetLocalizationData) {
            return framer.notify("You are not allowed to set localization data", {
                variant: "error",
            })
        } else if (!accessToken) {
            return framer.notify("Access Token is missing", {
                variant: "error",
            })
        } else if (!projectId) {
            return framer.notify("Project ID is missing", {
                variant: "error",
            })
        } else if (!activeLocale) {
            return framer.notify("Active locale is missing", {
                variant: "error",
            })
        }

        setIsExporting(true)
        try {
            const groups = await framer.getLocalizationGroups()
            const defaultLocale = await framer.getDefaultLocale()
            const sourceFilename = `framer-source-${defaultLocale.code}.xliff`
            // Ensure source file exists
            const fileId = await ensureSourceFile(sourceFilename, projectId, accessToken, defaultLocale, groups)

            // Generate translation xliff
            const xliffContent = generateXliff(defaultLocale, activeLocale, groups)
            const filename = `translations-${activeLocale.code}.xliff`

            console.log(xliffContent)

            // Upload storage
            const storageRes = await uploadStorage(xliffContent, accessToken, filename)
            if (!storageRes.ok) {
                framer.notify("Failed to upload file to Crowdin storage", {
                    variant: "error",
                })
                return
            }
            const storageData = (await storageRes.json()) as CrowdinStorageResponse
            const storageId = storageData.data.id

            // Upload translation
            const uploadRes = await updateTranslation(projectId, storageId, fileId, accessToken, activeLocale)
            if (!uploadRes.ok) {
                const errMsg = await uploadRes.text()
                framer.notify(`Crowdin upload failed: ${errMsg}`, { variant: "error" })
                return
            }

            framer.notify("Export to Crowdin complete", { variant: "success", durationMs: 5000 })
        } catch (error) {
            console.error("Error exporting to Crowdin:", error)
            framer.notify(`Export error: ${error instanceof Error ? error.message : "An unknown error occurred"}`, {
                variant: "error",
                durationMs: 10000,
            })
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <div className="logo-container">
                <div className="logo" aria-label="Crowdin Logo" />
            </div>
            <p>
                Get an access token in the{" "}
                <a href="https://crowdin.com/settings#api-key" target="_blank" rel="noopener noreferrer">
                    dashboard
                </a>
                .
            </p>
            <hr />
            <div className={`form-field ${isImporting || isExporting ? "disabled" : ""}`}>
                <label>
                    <p>Access Token</p>
                    {isLoading && <div className="framer-spinner" />}
                    <input
                        ref={inputRef}
                        type="text"
                        value={tokenInputValue}
                        placeholder="Enter Token…"
                        onChange={e => {
                            setTokenInputValue(e.target.value)
                        }}
                        onKeyDown={handleTokenInputKeyDown}
                        onBlur={handleTokenInputBlur}
                    />
                </label>
                <label>
                    <p>Project</p>
                    <select
                        ref={selectRef}
                        value={projectId || ""}
                        onChange={e => {
                            setProjectId(Number(e.target.value))
                        }}
                        disabled={!accessToken || !projectList.length}
                    >
                        <option value="" disabled>
                            Choose Project…
                        </option>
                        {projectList.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="button-stack">
                <button
                    type="button"
                    onClick={() => {
                        void importFromCrowdIn()
                    }}
                    disabled={!isAllowedToSetLocalizationData || !accessToken || !projectId || isExporting}
                >
                    {isImporting ? <div className="framer-spinner" /> : "Import"}
                </button>

                <button
                    type="button"
                    className="framer-button-primary"
                    onClick={() => {
                        void exportToCrowdIn()
                    }}
                    disabled={!accessToken || !projectId || isImporting}
                >
                    {isExporting ? <div className="framer-spinner" /> : "Export"}
                </button>
            </div>
        </main>
    )
}
