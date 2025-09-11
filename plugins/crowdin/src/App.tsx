import { framer, type Locale, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"
import "./App.css"
import { ProjectsGroups, Translations } from "@crowdin/crowdin-api-client"
import hero from "./assets/hero.png"
import { Loading } from "./components/Loading"
import {
    createValuesBySourceFromXliff,
    downloadBlob,
    generateXliff,
    getFileId,
    parseXliff,
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
export function App({
    activeLocale,
    locales,
    groups,
}: {
    activeLocale: Locale | null
    locales: readonly Locale[]
    groups: readonly LocalizationGroup[]
}) {
    console.log({ activeLocale, locales, groups })

    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")

    const [accessToken, setAccessToken] = useState<string>("")
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)

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
                    console.log(response.data)
                    const projects = response.data.map(({ data }: { data: Project }) => ({
                        id: data.id,
                        name: data.name,
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

    // const crowdinClient = new crowdin({
    //     token: accessToken,
    // })

    const createCrowdinClient = (token: string) => ({
        projects: new ProjectsGroups({ token }),
        translations: new Translations({ token }),
    })

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

        console.log(client.translations)

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

            framer.notify(`Successfully imported localizations for ${targetLocale.name}`)
        } catch (err) {
            console.error("Error importing from Crowdin:", err)
            framer.notify("Error importing from Crowdin Could be because translation missing in CrowdIn. Please check the source", { variant: "error" })
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
            const groups = await framer.getLocalizationGroups()
            const defaultLocale = await framer.getDefaultLocale()
            const xliffContent = generateXliff(defaultLocale, activeLocale, groups)
            const filename = `translations-${activeLocale.code}.xliff`
            downloadBlob(xliffContent, filename, "application/x-xliff+xml")
            if (!xliffContent) {
                framer.notify("No translation content found for active locale", {
                    variant: "error",
                })
                return
            }

            const fileId = await getFileId(projectId, filename, accessToken)
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
                            void validateAccessToken(e.target.value)
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
