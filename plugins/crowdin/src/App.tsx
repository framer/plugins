import { framer, type Locale, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useState } from "react"
import "./App.css"
import hero from "./assets/hero.png"
import { Loading } from "./components/Loading"
import { dataSources } from "./dataSources"
import { addStrings } from "./xliff"

void framer.showUI({
    width: 260,
    height: 350,
})

interface Project {
    readonly id: number
    readonly name: string
}

// Allow both `null` and `undefined` for wrapper and `data`
type WrappedProject = {
    data?: { id?: number; name: string | null } | null
} | null

export function App() {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")
    const [accessToken, setAccessToken] = useState<string | null>("")
    const [projectList, setProjectList] = useState<readonly Project[] | null>(null)
    const [selectedLocaleId, setSelectedLocaleId] = useState<string>("")
    const [projectId, setProjectId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [locales, setLocales] = useState<readonly Locale[]>([])
    const [defaultLocale, setDefaultLocale] = useState<Locale | null>(null)

    useEffect(() => {
        async function loadLocales() {
            const initialLocales = await framer.getLocales()
            const initialDefaultLocale = await framer.getDefaultLocale()
            setLocales(initialLocales)
            setDefaultLocale(initialDefaultLocale)

            const activeLocale = await framer.getActiveLocale()
            if (activeLocale) {
                setSelectedLocaleId(activeLocale.id)
            }
        }

        void loadLocales()
    }, [])
    const getDataSource = async (token: string): Promise<Project[]> => {
        const dataSource = dataSources.find(option => option.id === "projects")
        if (!dataSource) throw new Error("No data source found for id projects.")

        try {
            const data: WrappedProject[] = await dataSource.fetch(token)

            return data
                .filter(
                    (item): item is { data: { id?: number; name: string | null } } =>
                        item !== null && item.data !== undefined
                )
                .map(item => ({
                    id: item.data.id ?? 0, // default id if missing
                    name: item.data.name || "", // default name if null
                }))
        } catch (error) {
            console.error("Error fetching CrowdIn data:", error)
            throw error
        }
    }

    // Validate token and fetch projects
    const validateAccessToken = useCallback((token: string | null) => {
        setAccessToken(token)

        if (token) {
            getDataSource(token)
                .then((projects: Project[]) => {
                    setProjectList([...projects]) // store as readonly array
                })
                .catch(() => {
                    setProjectList(null) // reset state on error
                })
        } else {
            setProjectList(null) // reset state if token is null
        }
    }, [])

    async function exportToCrowdIn(defaultLocale: Locale, targetLocale: Locale) {
        if (!accessToken || !projectId) {
            framer.notify("Access Token or Project ID missing", {
                variant: "error",
            })
            return
        }
        setIsLoading(true)
        try {
            const fileName = `framer_locale_from_${defaultLocale.code}_${targetLocale.code}.json`
            await addStrings(projectId, fileName, accessToken)
            setIsLoading(false)
        } catch (err) {
            console.error("Error exporting to CrowdIn:", err)
            setIsLoading(false)
            framer.notify("Error exporting to CrowdIn:", {
                variant: "error",
            })
            throw err
        }
    }

    async function importFromCrowdIn() {
        if (!accessToken || !projectId || !selectedLocaleId) {
            console.error("Access Token, Project ID, or Locale not set")
            return
        }

        try {
            // 1. Trigger Crowdin build for latest translations
            const buildRes = await fetch(`https://api.crowdin.com/api/v2/projects/${projectId}/translations/builds`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            })
            const buildData = await buildRes.json()
            const buildId = buildData.data.id

            // 2. Wait for build to finish
            let buildStatus = "inProgress"
            while (buildStatus === "inProgress") {
                const statusRes = await fetch(
                    `https://api.crowdin.com/api/v2/projects/${projectId}/translations/builds/${buildId}`,
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }
                )
                const statusData = await statusRes.json()
                buildStatus = statusData.data.status
                if (buildStatus === "inProgress") {
                    await new Promise(r => setTimeout(r, 2000))
                }
            }

            // 3. Download the built translations archive
            const downloadRes = await fetch(
                `https://api.crowdin.com/api/v2/projects/${projectId}/translations/builds/${buildId}/download`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            )
            const downloadData = await downloadRes.json()
            const downloadUrl = downloadData.data.url

            // 4. Fetch ZIP file and extract JSON
            const zipRes = await fetch(downloadUrl)
            const blob = await zipRes.blob()
            console.log(blob)
        } catch (err) {
            console.error("Error importing Crowdin translations:", err)
        }
    }

    function handleExport() {
        if (!selectedLocaleId || !defaultLocale) return
        const targetLocale = locales.find(locale => locale.id === selectedLocaleId)
        if (!targetLocale) {
            throw new Error(`Could not find locale with id ${selectedLocaleId}`)
        }
        void exportToCrowdIn(defaultLocale, targetLocale)
    }
    if (isLoading) {
        return <Loading />
    }
    return (
        <main className="framer-hide-scrollbar setup">
            <img src={hero} alt="Greenhouse Hero" />
            <div className="form-field">
                <label className="show">
                    <p>Token</p>
                    <input
                        id="accessToken"
                        type="text"
                        required
                        placeholder="Enter Access Token…"
                        value={accessToken ?? ""}
                        onChange={event => {
                            validateAccessToken(event.target.value)
                        }}
                    />
                </label>
                <label className="show">
                    <p>Project ID</p>
                    <select
                        id="spaceId"
                        required
                        onChange={event => {
                            setProjectId(event.target.value)
                        }}
                        value={projectId}
                        disabled={!accessToken}
                    >
                        <option value="">Choose Project…</option>
                        {projectList?.map(({ id, name }) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="button-stack">
                    <button
                        type="button"
                        onClick={() => {
                            if (!isAllowedToSetLocalizationData) return
                            importFromCrowdIn()
                        }}
                        disabled={!isAllowedToSetLocalizationData}
                        title={isAllowedToSetLocalizationData ? undefined : "Insufficient permissions"}
                    >
                        Import
                    </button>

                    <button
                        type="button"
                        className="framer-button-primary"
                        onClick={handleExport}
                        disabled={!selectedLocaleId}
                    >
                        Export
                    </button>
                </div>
            </div>
        </main>
    )
}
