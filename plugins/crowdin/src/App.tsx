import { framer, type Locale, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"
import "./App.css"
import { ProjectsGroups, Translations } from "@crowdin/crowdin-api-client"
import hero from "./assets/hero.png"
import { Loading } from "./components/Loading"
import {
    getFileId,
    getTranslationFileContent,
    parseXliff12,
    parseXliff20,
    updateTranslation,
    uploadStorage,
} from "./xliff"

void framer.showUI({ width: 260, height: 400 })

interface Project {
    readonly id: number
    readonly name: string
}
interface CrowdinStorageResponse {
    data: {
        id: string
    }
}

// ----- App component -----
export function App() {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")

    const [accessToken, setAccessToken] = useState<string>("")
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)

    const [activeLocale, setActiveLocale] = useState<Locale | null>(null)

    const validateAccessToken = useCallback(async (token: string) => {
        setAccessToken(token)
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
                    const projects = response.data.map((item: { data: Project }) => ({
                        id: item.data.id,
                        name: item.data.name,
                    }))
                    setProjectList(projects)
                })
                .catch((err: unknown) => {
                    console.error(err)
                })
                .finally(() => {
                    setIsLoading(false)
                })
        } else {
            setProjectList([])
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        async function loadStoredToken() {
            const storedToken = await framer.getPluginData("accessToken")
            if (storedToken) {
                setAccessToken(storedToken)
                await validateAccessToken(storedToken)
            }
        }
        void loadStoredToken()
    }, [validateAccessToken])

    const createCrowdinClient = (token: string) => ({
        projects: new ProjectsGroups({ token }),
        translations: new Translations({ token }),
    })

    useEffect(() => {
        async function fetchActiveLocale() {
            const locale = await framer.getActiveLocale()
            if (locale) setActiveLocale(locale)
        }
        void fetchActiveLocale()
    }, [])

    // ------------------ Import from Crowdin ------------------
    async function importFromCrowdIn() {
        if (!accessToken || !projectId || !activeLocale) {
            framer.notify("Access Token, Project ID, or active locale missing", {
                variant: "error",
            })
            return
        }

        setIsLoading(true)
        const client = createCrowdinClient(accessToken)
        const locales = await framer.getLocales()

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

            const translationsResult = fileContent.includes('<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0"')
                ? parseXliff20(fileContent, locales)
                : parseXliff12(fileContent, locales)

            const { valuesBySource, targetLocale } = translationsResult

            if (targetLocale.id) {
                const updates = Object.entries(valuesBySource).map(([, val]) => {
                    const safeValue: string = val[targetLocale.id]?.value ?? ""
                    const defaultMessage: string = val[targetLocale.id]?.defaultMessage ?? ""
                    return {
                        defaultMessage: defaultMessage,
                        action: "set" as const,
                        value: safeValue,
                        needsReview: true,
                    }
                })
                await framer.setLocalizationData({ [targetLocale.id]: updates })
                framer.notify(`Imported ${Object.keys(valuesBySource).length} strings`, {
                    variant: "success",
                })
            }
        } catch (err) {
            console.error("Error importing from Crowdin:", err)
            framer.notify("Error importing from Crowdin", { variant: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    // ------------------ Export to Crowdin ------------------
    async function exportToCrowdIn() {
        if (!accessToken || !projectId || !activeLocale) {
            framer.notify("Access Token, Project ID, or active locale missing", {
                variant: "error",
            })
            return
        }

        setIsLoading(true)
        try {
            const xliffContent = await getTranslationFileContent(activeLocale)
            if (!xliffContent) {
                framer.notify("No translation content found for active locale", {
                    variant: "error",
                })
                return
            }

            const fileId = await getFileId(projectId, `translations-${activeLocale.code}.xliff`, accessToken)
            if (!fileId) {
                framer.notify("File not found in Crowdin project", { variant: "error" })
                return
            }

            // Upload file content to Crowdin storage
            const storageRes = await uploadStorage(xliffContent, accessToken, activeLocale)
            if (!storageRes.ok) {
                framer.notify("Failed to upload file to Crowdin storage", {
                    variant: "error",
                })
                return
            }
            const storageData = (await storageRes.json()) as CrowdinStorageResponse
            const storageId = storageData.data.id

            // Upload translation for that locale
            const uploadRes = await updateTranslation(projectId, storageId, fileId, accessToken, activeLocale)
            if (!uploadRes.ok) {
                const errMsg = await uploadRes.text()
                framer.notify(`Crowdin upload failed: ${errMsg}`, { variant: "error" })
                return
            }

            framer.notify("Export to Crowdin complete", { variant: "success" })
        } catch (err) {
            console.error("Error exporting to Crowdin:", err)
            framer.notify("Error exporting to Crowdin", { variant: "error" })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <img src={hero} alt="Crowdin Hero" />
            <div className="form-field" style={{ position: "relative" }}>
                {isLoading && (
                    <div className="loader">
                        <Loading />
                    </div>
                )}

                <label className="show">
                    <p>Token</p>
                    <input
                        type="text"
                        placeholder="Enter Access Token…"
                        value={accessToken}
                        onChange={e => {
                            validateAccessToken(e.target.value)
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
                        disabled={!accessToken}
                    >
                        <option value="">Choose Project…</option>
                        {projectList.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>

                {activeLocale && (
                    <label className="show">
                        <p>
                            <strong>Active Locale:</strong> {activeLocale.name} ({activeLocale.code})
                        </p>
                    </label>
                )}

                <div className="button-stack">
                    <button
                        type="button"
                        onClick={() => {
                            void importFromCrowdIn()
                        }}
                        disabled={!isAllowedToSetLocalizationData || !activeLocale}
                        title={isAllowedToSetLocalizationData ? undefined : "Insufficient permissions"}
                    >
                        Import
                    </button>

                    <button
                        type="button"
                        className="framer-button-primary"
                        onClick={() => {
                            void exportToCrowdIn()
                        }}
                        disabled={!activeLocale}
                    >
                        Export
                    </button>
                </div>
            </div>
        </main>
    )
}
