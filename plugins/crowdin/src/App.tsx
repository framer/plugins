import { framer, type Locale, useIsAllowedTo } from "framer-plugin"
import cx from "classnames"
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
import { useDynamicPluginHeight } from "./useDynamicPluginHeight"

const PLUGIN_WIDTH = 280

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
    const [mode, setMode] = useState<"export" | "import" | null>(null)
    const [accessToken, setAccessToken] = useState<string>("")
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)

    useDynamicPluginHeight({ width: PLUGIN_WIDTH })

    const validateAccessToken = useCallback(async (token: string): Promise<boolean> => {
        const projects = await validateAccessTokenAndGetProjects(token)

        if (projects) {
            setAccessToken(token)
            setProjectList(projects)

            if (projects.length === 1 && projects[0]?.id) {
                setProjectId(projects[0].id)
            } else {
                setProjectId(0)
            }

            return true
        } else {
            setAccessToken("")
            setProjectList([])
            setProjectId(0)
            return false
        }
    }, [])

    useEffect(() => {
        async function loadStoredToken() {
            const storedToken = await framer.getPluginData("accessToken")
            if (storedToken) {
                setAccessToken(storedToken)
                void validateAccessToken(storedToken)
            }
        }
        void loadStoredToken()
    }, [validateAccessToken])

    if (mode === null) {
        return <Home setMode={setMode} />
    } else {
        return (
            <ConfigurationPage
                mode={mode}
                activeLocale={activeLocale}
                locales={locales}
                accessToken={accessToken}
                projectId={projectId}
                projectList={projectList}
                validateAccessToken={validateAccessToken}
                setProjectId={setProjectId}
            />
        )
    }
}

function Home({ setMode }: { setMode: (mode: "export" | "import") => void }) {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")

    return (
        <main className="home">
            <hr />
            <div className="hero">
                <div className="logo">
                    <img src="/icon.svg" alt="Crowdin Logo" />
                </div>
                <h1>Translate with Crowdin</h1>
                <p>Enter your access token from Crowdin and select a project to export Locales.</p>
            </div>
            <div className="button-row">
                <button
                    onClick={() => {
                        setMode("export")
                    }}
                >
                    Export
                </button>
                <button
                    onClick={() => {
                        if (!isAllowedToSetLocalizationData) return
                        setMode("import")
                    }}
                    disabled={!isAllowedToSetLocalizationData}
                    title={isAllowedToSetLocalizationData ? undefined : "Insufficient permissions"}
                >
                    Import
                </button>
            </div>
        </main>
    )
}

function ConfigurationPage({
    mode,
    activeLocale,
    locales,
    accessToken,
    projectId,
    projectList,
    validateAccessToken,
    setProjectId,
}: {
    mode: "export" | "import"
    activeLocale: Locale | null
    locales: readonly Locale[]
    accessToken: string
    projectId: number
    projectList: readonly Project[]
    validateAccessToken: (accessToken: string) => Promise<boolean>
    setProjectId: (projectId: number) => void
}) {
    const selectedLocales = []

    const [accessTokenValue, setAccessTokenValue] = useState<string>(accessToken)
    const [accessTokenState, setAccessTokenState] = useState<"none" | "valid" | "invalid" | "loading">("none")

    const localesTitle = selectedLocales.length === 1 ? "Locale" : "Locales"
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")
    const canPerformAction = accessToken && projectId && (mode === "import" ? isAllowedToSetLocalizationData : true)

    useEffect(() => {
        setAccessTokenValue(accessToken)
    }, [accessToken])

    async function confirmAccessToken() {
        if (accessTokenValue === accessToken) {
            return
        }

        setAccessTokenState("loading")
        const isValid = await validateAccessToken(accessTokenValue)
        setAccessTokenState(isValid ? "valid" : "invalid")
    }

    return (
        <main>
            <hr />
            <div className="controls-stack">
                <PropertyControl label="Token">
                    <div className={cx("access-token-input", accessTokenState !== "none" && "with-state")}>
                        <input
                            type="text"
                            placeholder="Crowdin token…"
                            autoFocus
                            value={accessTokenValue}
                            onChange={e => {
                                setAccessTokenValue(e.target.value)
                            }}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    void confirmAccessToken()
                                }
                            }}
                            onBlur={() => {
                                void confirmAccessToken()
                            }}
                        />
                        <div className="icon">
                            {accessTokenState === "loading" ? (
                                <div className="framer-spinner" />
                            ) : accessTokenState === "invalid" ? (
                                <div />
                            ) : accessTokenState === "valid" ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="6"
                                    height="4.5"
                                    fill="none"
                                    overflow="visible"
                                >
                                    <path
                                        d="M 0 2.5 L 2.118 4.5 L 6 0"
                                        fill="transparent"
                                        strokeWidth="1.5"
                                        stroke="rgb(64, 222, 127)"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    ></path>
                                </svg>
                            ) : null}
                        </div>
                    </div>
                </PropertyControl>
                <PropertyControl label="Project" disabled={!accessToken}>
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
                </PropertyControl>
                <PropertyControl label={localesTitle}>
                    <select value={""}>
                        <option value="">All Locales</option>
                        <hr />
                        {locales.map(locale => (
                            <option key={locale.id} value={locale.id}>
                                {locale.name}
                            </option>
                        ))}
                    </select>
                    <button>Add</button>
                </PropertyControl>
            </div>
            <hr />
            <button
                className="framer-button-primary"
                disabled={!canPerformAction}
                title={!isAllowedToSetLocalizationData ? "Insufficient permissions" : undefined}
            >
                {mode === "export" ? "Export" : "Import"} {localesTitle}
            </button>
        </main>
    )
}

function PropertyControl({
    label,
    disabled = false,
    children,
}: {
    label: string
    disabled?: boolean
    children: React.ReactNode | React.ReactNode[]
}) {
    return (
        <div className={cx("property-control", disabled && "disabled")}>
            <p>{label}</p>
            <div className="content">{children}</div>
        </div>
    )
}

// Returns a list of projects or null if the access token is invalid
async function validateAccessTokenAndGetProjects(token: string): Promise<Project[] | null> {
    // Persist token
    if (framer.isAllowedTo("setPluginData")) {
        void framer.setPluginData("accessToken", token)
    }

    if (token) {
        try {
            const projectsGroupsApi = new ProjectsGroups({ token })
            const response = await projectsGroupsApi.withFetchAll().listProjects()

            // Only log in development
            if (window.location.hostname === "localhost") {
                console.log(response.data)
            }
            const projects = response.data.map(({ data }: { data: Project }) => ({
                id: data.id,
                name: data.name,
            }))
            return projects
        } catch (error) {
            console.error(error)
            framer.notify("Invalid access token", { variant: "error" })
            return null
        }
    } else {
        return null
    }
}
