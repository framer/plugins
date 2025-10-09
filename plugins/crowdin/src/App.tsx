import { framer, type Locale, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { ProjectsGroups, Translations } from "@crowdin/crowdin-api-client"
import hero from "./assets/hero.png"
import { Loading } from "./components/Loading"
import {
    createValuesBySourceFromXliff,
    ensureSourceFile,
    generateXliff,
    parseXliff,
    updateTranslation,
    uploadStorage,
} from "./xliff"

void framer.showUI({ width: 325, height: 325 })

interface Project {
    readonly id: number
    readonly name: string
}

interface CrowdinStorageResponse {
    data: {
        id: number
    }
}

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, ms = 300) {
    const timeoutRef = useRef<NodeJS.Timeout>()
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            fn(...args)
        }, ms)
    }
}

// ----- App component -----
export function App({ activeLocale, locales }: { activeLocale: Locale | null; locales: readonly Locale[] }) {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")

    const [accessToken, setAccessToken] = useState<string>("")
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)

    // Blur the input when loading
    useEffect(() => {
        if (isLoading && inputRef.current) {
            inputRef.current.blur()
        }
    }, [isLoading])

    const validateAccessToken = useCallback((token: string) => {
        setIsLoading(true)

        if (token) {
            // persist token
            if (framer.isAllowedTo("setPluginData")) {
                void framer.setPluginData("accessToken", token)
            }
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
                })
                .catch((err: unknown) => {
                    console.error(err)
                    setProjectList([])
                    framer.notify("Invalid access token", { variant: "error" })
                })
                .finally(() => {
                    setIsLoading(false)
                })
        } else {
            setProjectList([])
            setIsLoading(false)
        }
    }, [])

    // Debounce the access token change to prevent too many requests
    const onAccessTokenChange = useDebouncedCallback(validateAccessToken, 300)

    useEffect(() => {
        async function loadStoredToken() {
            const storedToken = await framer.getPluginData("accessToken")
            if (storedToken) {
                setAccessToken(storedToken)
                validateAccessToken(storedToken)
            }
        }
        void loadStoredToken()
    }, [validateAccessToken])

    const createCrowdinClient = (token: string) => ({
        projects: new ProjectsGroups({ token }),
        translations: new Translations({ token }),
    })

    // ------------------ Import from Crowdin ------------------
    async function importFromCrowdIn() {
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

        setIsLoading(true)
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
            const valuesBySource = createValuesBySourceFromXliff(xliff, targetLocale)

            const result = await framer.setLocalizationData({ valuesBySource })

            if (result.valuesBySource.errors.length > 0) {
                throw new Error(`Import errors: ${result.valuesBySource.errors.map(error => error.error).join(", ")}`)
            }

            framer.notify(`Successfully imported localizations for ${targetLocale.name}`, { variant: "success" })
        } catch (error) {
            console.error("Error importing from Crowdin:", error)
            framer.notify(
                `Error importing from Crowdin: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
                { variant: "error" }
            )
        } finally {
            setIsLoading(false)
        }
    }
    async function exportToCrowdIn() {
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

        setIsLoading(true)
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

            framer.notify("Export to Crowdin complete", { variant: "success" })
        } catch (error) {
            console.error("Error exporting to Crowdin:", error)
            framer.notify(
                `Error exporting to Crowdin: ${error instanceof Error ? error.message : "An unknown error occurred"}`,
                { variant: "error" }
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={hero} alt="Crowdin Hero" />
            <div className="form-field">
                {isLoading && (
                    <div className="loader">
                        <Loading />
                    </div>
                )}
                <label className="show">
                    <p>Access Token</p>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Enter Token…"
                        defaultValue={accessToken}
                        onChange={e => {
                            onAccessTokenChange(e.target.value)
                        }}
                    />
                </label>
                <label className="show">
                    <p>Project</p>
                    <select
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
                <div className="button-stack">
                    <button
                        type="button"
                        onClick={() => {
                            void importFromCrowdIn()
                        }}
                        disabled={!isAllowedToSetLocalizationData || !accessToken || !projectId}
                    >
                        Import
                    </button>

                    <button
                        type="button"
                        className="framer-button-primary"
                        onClick={() => {
                            void exportToCrowdIn()
                        }}
                        disabled={!accessToken || !projectId}
                    >
                        Export
                    </button>
                </div>
            </div>
        </main>
    )
}
