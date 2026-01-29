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
import { CheckIcon, ChevronDownIcon, XIcon } from "./Icons"

const PLUGIN_WIDTH = 280

enum AccessTokenState {
    None = "none",
    Valid = "valid",
    Invalid = "invalid",
    Loading = "loading",
}

interface Project {
    readonly id: number
    readonly name: string
}

interface CrowdinStorageResponse {
    data: {
        id: number
    }
}

export function App({ activeLocale, locales }: { activeLocale: Locale | null; locales: readonly Locale[] }) {
    const [mode, setMode] = useState<"export" | "import" | null>(null)
    const [accessToken, setAccessToken] = useState<string>("")
    const [accessTokenState, setAccessTokenState] = useState<AccessTokenState>(AccessTokenState.None)
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [selectedLocaleIds, setSelectedLocaleIds] = useState<string[]>(activeLocale ? [activeLocale.id] : [])
    const validatingAccessTokenRef = useRef<boolean>(false)

    useDynamicPluginHeight({ width: PLUGIN_WIDTH })

    const validateAccessToken = useCallback(
        async (token: string): Promise<void> => {
            if (validatingAccessTokenRef.current) return
            if (token === accessToken) return

            if (!token) {
                setAccessToken("")
                setProjectList([])
                setProjectId(0)
                setAccessTokenState(AccessTokenState.None)
                return
            }

            validatingAccessTokenRef.current = true
            setAccessTokenState(AccessTokenState.Loading)

            try {
                const { isValid, projects } = await validateAccessTokenAndGetProjects(token)

                setAccessToken(token)

                if (isValid) {
                    setProjectList(projects ?? [])

                    if (Array.isArray(projects) && projects.length === 1 && projects[0]?.id) {
                        setProjectId(projects[0].id)
                    } else {
                        setProjectId(0)
                    }

                    setAccessTokenState(AccessTokenState.Valid)
                } else {
                    setProjectList([])
                    setProjectId(0)
                    setAccessTokenState(AccessTokenState.Invalid)
                }
            } catch (error) {
                console.error(error)
                framer.notify(
                    `Error validating access token: ${error instanceof Error ? error.message : "Unknown error"}`,
                    { variant: "error" }
                )
                setProjectList([])
                setProjectId(0)
                setAccessTokenState(AccessTokenState.Invalid)
            }

            validatingAccessTokenRef.current = false
        },
        [accessToken, accessTokenState]
    )

    useEffect(() => {
        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData("accessToken", accessToken)
        }
    }, [accessToken])

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
                locales={locales}
                accessToken={accessToken}
                accessTokenState={accessTokenState}
                projectId={projectId}
                projectList={projectList}
                validateAccessToken={validateAccessToken}
                setProjectId={setProjectId}
                selectedLocaleIds={selectedLocaleIds}
                setSelectedLocaleIds={setSelectedLocaleIds}
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
    locales,
    accessToken,
    accessTokenState,
    projectId,
    projectList,
    validateAccessToken,
    setProjectId,
    selectedLocaleIds,
    setSelectedLocaleIds,
}: {
    mode: "export" | "import"
    locales: readonly Locale[]
    accessToken: string
    accessTokenState: AccessTokenState
    projectId: number
    projectList: readonly Project[]
    validateAccessToken: (accessToken: string) => Promise<void>
    setProjectId: (projectId: number) => void
    selectedLocaleIds: string[]
    setSelectedLocaleIds: (localeIds: string[]) => void
}) {
    const [accessTokenValue, setAccessTokenValue] = useState<string>(accessToken)
    const [accessTokenInputFocused, setAccessTokenInputFocused] = useState<boolean>(false)
    const accessTokenInputRef = useRef<HTMLInputElement>(null)

    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")
    const canPerformAction = accessToken && projectId && (mode === "import" ? isAllowedToSetLocalizationData : true)
    const accessTokenValueHasChanged = accessTokenValue !== accessToken

    useEffect(() => {
        setAccessTokenValue(accessToken)
    }, [accessToken])

    function onLocaleButtonClick(e: React.MouseEvent<HTMLButtonElement>, localeId: string | null) {
        const rect = e.currentTarget.getBoundingClientRect()

        void framer.showContextMenu(
            [
                {
                    label: "All Locales",
                    checked: selectedLocaleIds.length === 0,
                    onAction: () => {
                        setSelectedLocaleIds([])
                    },
                },
                {
                    type: "separator",
                },
                ...locales.map(locale => ({
                    label: locale.name,
                    secondaryLabel: locale.code,
                    checked: locale.id === localeId,
                    enabled: !(selectedLocaleIds.includes(locale.id) && locale.id !== localeId),
                    onAction: () => {
                        if (selectedLocaleIds.includes(locale.id)) {
                            setSelectedLocaleIds(selectedLocaleIds.filter(id => id !== locale.id))
                        } else {
                            setSelectedLocaleIds([...selectedLocaleIds, locale.id])
                        }
                    },
                })),
            ],
            {
                location: {
                    x: rect.right - 4,
                    y: rect.bottom + 4,
                },
                width: 250,
                placement: "bottom-left",
            }
        )
    }

    function onRemoveLocaleClick(e: React.MouseEvent<HTMLDivElement>, localeId: string) {
        e.stopPropagation()
        setSelectedLocaleIds(selectedLocaleIds.filter(id => id !== localeId))
    }

    return (
        <main>
            <hr />
            <div className="controls-stack">
                <PropertyControl label="Token">
                    <div className={cx("access-token-input")}>
                        <input
                            ref={accessTokenInputRef}
                            type="text"
                            placeholder="Crowdin token…"
                            autoFocus
                            value={accessTokenValue}
                            className={
                                accessTokenState === AccessTokenState.Invalid && !accessTokenValueHasChanged
                                    ? "error"
                                    : undefined
                            }
                            onChange={e => {
                                setAccessTokenValue(e.target.value)
                            }}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    void validateAccessToken(accessTokenValue)
                                }
                            }}
                            onBlur={() => {
                                setAccessTokenInputFocused(false)
                                void validateAccessToken(accessTokenValue)
                            }}
                            onFocus={() => {
                                setAccessTokenInputFocused(true)
                            }}
                        />
                        {accessTokenState === AccessTokenState.Loading && (
                            <div className="icon">
                                <div className="framer-spinner" />
                            </div>
                        )}
                        {accessTokenState === AccessTokenState.Valid && !accessTokenValueHasChanged && (
                            <div className="icon">
                                <CheckIcon />
                            </div>
                        )}
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
                <PropertyControl label="Locales">
                    {selectedLocaleIds.length === 0 && (
                        <button
                            className="locale-button"
                            onClick={e => {
                                onLocaleButtonClick(e, null)
                            }}
                        >
                            All Locales
                            <div className="icon-button">
                                <ChevronDownIcon />
                            </div>
                        </button>
                    )}
                    {selectedLocaleIds.length > 0 && (
                        <div className="button-stack">
                            {selectedLocaleIds.map(id => (
                                <button
                                    className="locale-button"
                                    key={id}
                                    onClick={e => {
                                        onLocaleButtonClick(e, id)
                                    }}
                                >
                                    {locales.find(locale => locale.id === id)?.name ?? id}
                                    <div
                                        className="icon-button"
                                        title="Remove locale"
                                        onClick={e => {
                                            onRemoveLocaleClick(e, id)
                                        }}
                                    >
                                        <XIcon />
                                    </div>
                                </button>
                            ))}
                            <button
                                onClick={e => {
                                    onLocaleButtonClick(e, null)
                                }}
                            >
                                Add
                            </button>
                        </div>
                    )}
                </PropertyControl>
            </div>
            <hr />
            <button
                className="framer-button-primary"
                disabled={!canPerformAction}
                title={!isAllowedToSetLocalizationData ? "Insufficient permissions" : undefined}
            >
                {mode === "export" ? "Export" : "Import"} {selectedLocaleIds.length === 1 ? "Locale" : "Locales"}
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
async function validateAccessTokenAndGetProjects(
    token: string
): Promise<{ isValid: boolean; projects: Project[] | null }> {
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
            return { isValid: true, projects }
        } catch (error) {
            console.error(error)
            framer.notify("Invalid access token", { variant: "error" })
            return { isValid: false, projects: null }
        }
    } else {
        return { isValid: false, projects: null }
    }
}
