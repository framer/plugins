import cx from "classnames"
import { framer, type LocalizationData, type Locale, useIsAllowedTo } from "framer-plugin"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import { ProjectsGroups, Translations } from "@crowdin/crowdin-api-client"
import { CheckIcon, ChevronDownIcon, XIcon } from "./Icons"
import { useDynamicPluginHeight } from "./useDynamicPluginHeight"
import {
    createValuesBySourceFromXliff,
    ensureSourceFile,
    generateXliff,
    getProjectTargetLanguageIds,
    parseXliff,
    updateTranslation,
    uploadStorage,
} from "./xliff"

const PLUGIN_WIDTH = 280
const NO_PROJECT_PLACEHOLDER = "Choose Project…"
const ALL_LOCALES_ID = "__ALL_LOCALES__"

type LocaleIds = string[] | typeof ALL_LOCALES_ID

interface ImportConfirmationState {
    locales: Locale[]
    valuesByLocale: Record<string, NonNullable<LocalizationData["valuesBySource"]>>
    currentIndex: number
    confirmedLocaleIds: Set<string>
}

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

function createCrowdinClient(token: string) {
    return {
        projects: new ProjectsGroups({ token }),
        translations: new Translations({ token }),
    }
}

export function App({ activeLocale, locales }: { activeLocale: Locale | null; locales: readonly Locale[] }) {
    const [mode, setMode] = useState<"export" | "import" | null>(null)
    const [accessToken, setAccessToken] = useState<string>("")
    const [accessTokenState, setAccessTokenState] = useState<AccessTokenState>(AccessTokenState.None)
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [selectedLocaleIds, setSelectedLocaleIds] = useState<LocaleIds>(activeLocale ? [activeLocale.id] : [])
    const [availableLocaleIds, setAvailableLocaleIds] = useState<string[]>([])
    const [operationInProgress, setOperationInProgress] = useState<boolean>(false)
    const [importConfirmation, setImportConfirmation] = useState<ImportConfirmationState | null>(null)
    const validatingAccessTokenRef = useRef<boolean>(false)

    useDynamicPluginHeight({ width: PLUGIN_WIDTH })

    // Set close warning when importing or exporting
    useEffect(() => {
        try {
            if (operationInProgress || (mode === "import" && importConfirmation)) {
                if (mode === "import") {
                    void framer.setCloseWarning("Import in progress. Closing will cancel the import.")
                } else if (mode === "export") {
                    void framer.setCloseWarning("Export in progress. Closing will cancel the export.")
                }
            } else {
                void framer.setCloseWarning(false)
            }
        } catch (error) {
            console.error("Error setting close warning:", error)
        }
    }, [mode, operationInProgress, importConfirmation])

    const validateAccessToken = useCallback(
        async (token: string): Promise<void> => {
            if (validatingAccessTokenRef.current) return
            if (token === accessToken) return

            if (!token) {
                if (framer.isAllowedTo("setPluginData")) {
                    void framer.setPluginData("accessToken", "")
                }
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
        [accessToken]
    )

    // Resolve selected locale IDs to an array (handles "All Locales")
    const localeIdsToSync = selectedLocaleIds === ALL_LOCALES_ID ? availableLocaleIds : selectedLocaleIds

    // ------------------ Import from Crowdin ------------------
    async function startImportConfirmation() {
        if (operationInProgress) return

        if (!framer.isAllowedTo("setLocalizationData")) {
            return framer.notify("You are not allowed to set localization data", {
                variant: "error",
            })
        } else if (!accessToken) {
            return framer.notify("Access token is missing", {
                variant: "error",
            })
        } else if (!projectId) {
            return framer.notify("Project ID is missing", {
                variant: "error",
            })
        } else if (localeIdsToSync.length === 0) {
            return framer.notify("Select at least one locale to import", {
                variant: "error",
            })
        }

        setOperationInProgress(true)
        const client = createCrowdinClient(accessToken)
        const localesToSync = locales.filter(locale => localeIdsToSync.includes(locale.id))
        const valuesByLocale: Record<string, NonNullable<LocalizationData["valuesBySource"]>> = {}

        try {
            for (const locale of localesToSync) {
                const exportRes = await client.translations.exportProjectTranslation(projectId, {
                    targetLanguageId: locale.code,
                    format: "xliff",
                })
                const url = exportRes.data.url
                if (!url) {
                    framer.notify(`Crowdin export URL not found for ${locale.code}`, {
                        variant: "error",
                    })
                    continue
                }
                const resp = await fetch(url)
                const fileContent = await resp.text()
                const { xliff, targetLocale } = parseXliff(fileContent, locales)
                const valuesBySource = await createValuesBySourceFromXliff(xliff, targetLocale)
                if (!valuesBySource) continue
                valuesByLocale[locale.id] = valuesBySource
            }

            if (Object.keys(valuesByLocale).length === 0) {
                framer.notify("No translations could be fetched from Crowdin", {
                    variant: "error",
                })
                return
            }

            const orderedLocales = localesToSync.filter(locale => locale.id in valuesByLocale)
            setImportConfirmation({
                locales: orderedLocales,
                valuesByLocale,
                currentIndex: 0,
                confirmedLocaleIds: new Set(),
            })
        } catch (error) {
            console.error("Error fetching from Crowdin:", error)
            framer.notify(`Import error: ${error instanceof Error ? error.message : "An unknown error occurred"}`, {
                variant: "error",
                durationMs: 10000,
            })
        } finally {
            setOperationInProgress(false)
        }
    }

    function applyConfirmedImport(state: ImportConfirmationState) {
        if (state.confirmedLocaleIds.size === 0) {
            framer.notify("No locales selected for import", { variant: "info" })
            setImportConfirmation(null)
            return
        }

        const mergedValuesBySource: NonNullable<LocalizationData["valuesBySource"]> = {}
        for (const localeId of state.confirmedLocaleIds) {
            const localeValues = state.valuesByLocale[localeId]
            if (!localeValues) continue
            for (const sourceId of Object.keys(localeValues)) {
                const localeData = localeValues[sourceId]
                if (localeData) {
                    mergedValuesBySource[sourceId] ??= {}
                    Object.assign(mergedValuesBySource[sourceId], localeData)
                }
            }
        }

        setOperationInProgress(true)
        framer
            .setLocalizationData({ valuesBySource: mergedValuesBySource })
            .then(result => {
                if (result.valuesBySource.errors.length > 0) {
                    throw new Error(
                        result.valuesBySource.errors
                            .map(error => (error.sourceId ? `${error.error}: ${error.sourceId}` : error.error))
                            .join(", ")
                    )
                }
                const count = state.confirmedLocaleIds.size
                framer.closePlugin(`Successfully imported ${count} locale${count === 1 ? "" : "s"} from Crowdin`, {
                    variant: "success",
                })
            })
            .catch((error: unknown) => {
                console.error("Error applying import:", error)
                framer.notify(`Import error: ${error instanceof Error ? error.message : "An unknown error occurred"}`, {
                    variant: "error",
                    durationMs: 10000,
                })
                setOperationInProgress(false)
                setImportConfirmation(null)
            })
    }

    async function exportToCrowdin() {
        if (operationInProgress) return

        if (!accessToken) {
            return framer.notify("Access Token is missing", {
                variant: "error",
            })
        } else if (!projectId) {
            return framer.notify("Project ID is missing", {
                variant: "error",
            })
        } else if (localeIdsToSync.length === 0) {
            return framer.notify("Select at least one locale to export", {
                variant: "error",
            })
        }

        setOperationInProgress(true)
        const localesToSync = locales.filter(locale => localeIdsToSync.includes(locale.id))

        try {
            const groups = await framer.getLocalizationGroups()
            const defaultLocale = await framer.getDefaultLocale()
            const sourceFilename = `framer-source-${defaultLocale.code}.xliff`
            const fileId = await ensureSourceFile(sourceFilename, projectId, accessToken, defaultLocale, groups)

            for (const locale of localesToSync) {
                const xliffContent = generateXliff(defaultLocale, locale, groups)
                const filename = `translations-${locale.code}.xliff`

                const storageRes = await uploadStorage(xliffContent, accessToken, filename)
                if (!storageRes.ok) {
                    framer.notify(`Failed to upload ${locale.code} to Crowdin storage`, {
                        variant: "error",
                    })
                    continue
                }
                const storageData = (await storageRes.json()) as CrowdinStorageResponse
                const storageId = storageData.data.id

                const uploadRes = await updateTranslation(projectId, storageId, fileId, accessToken, locale)
                if (!uploadRes.ok) {
                    const errMsg = await uploadRes.text()
                    framer.notify(`Crowdin upload failed for ${locale.code}: ${errMsg}`, { variant: "error" })
                }
            }

            const count = localesToSync.length
            framer.notify(`Export to Crowdin complete (${count} ${count === 1 ? "locale" : "locales"})`, {
                variant: "success",
                durationMs: 5000,
            })
        } catch (error) {
            console.error("Error exporting to Crowdin:", error)
            framer.notify(`Export error: ${error instanceof Error ? error.message : "An unknown error occurred"}`, {
                variant: "error",
                durationMs: 10000,
            })
        } finally {
            setOperationInProgress(false)
        }
    }

    useEffect(() => {
        async function loadStoredToken() {
            const storedToken = await framer.getPluginData("accessToken")
            if (storedToken) {
                setAccessToken(storedToken)
                void validateAccessToken(storedToken)
            }
        }
        void loadStoredToken()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Fetch Crowdin project target languages when project is selected
    useEffect(() => {
        if (!projectId || !accessToken || accessTokenState !== AccessTokenState.Valid) {
            setAvailableLocaleIds([])
            setSelectedLocaleIds([])
            return
        }

        let cancelled = false
        const task = async () => {
            let targetLanguageIds: string[] = []
            try {
                const ids: string[] = await getProjectTargetLanguageIds(projectId, accessToken)
                if (!cancelled) {
                    targetLanguageIds = ids
                }
            } catch {
                if (!cancelled) {
                    targetLanguageIds = []
                }
            }

            // Locales that exist in both Framer and the selected Crowdin project
            const availableLocaleIds = locales
                .filter(locale => targetLanguageIds.includes(locale.code))
                .map(locale => locale.id)
            setAvailableLocaleIds(availableLocaleIds)
            setSelectedLocaleIds(availableLocaleIds)
        }
        void task()

        return () => {
            cancelled = true
        }
    }, [projectId, accessToken, accessTokenState, locales])

    function onSubmit() {
        if (mode === "export") {
            void exportToCrowdin()
        } else if (mode === "import") {
            void startImportConfirmation()
        }
    }

    if (mode === null) {
        return <Home setMode={setMode} />
    }

    if (mode === "import" && importConfirmation) {
        const { locales: confirmLocales, currentIndex, confirmedLocaleIds } = importConfirmation
        const currentLocale = confirmLocales[currentIndex]
        const remainingCount = confirmLocales.length - currentIndex

        return (
            <ConfirmationModal
                localeName={currentLocale?.name ?? ""}
                currentStep={currentIndex + 1}
                totalSteps={confirmLocales.length}
                remainingLocaleCount={remainingCount}
                skip={() => {
                    const nextIndex = currentIndex + 1
                    if (nextIndex >= confirmLocales.length) {
                        applyConfirmedImport({ ...importConfirmation, currentIndex: nextIndex })
                    } else {
                        setImportConfirmation({ ...importConfirmation, currentIndex: nextIndex })
                    }
                }}
                replace={() => {
                    const nextConfirmed = new Set(confirmedLocaleIds)
                    if (currentLocale) nextConfirmed.add(currentLocale.id)
                    const nextIndex = currentIndex + 1
                    if (nextIndex >= confirmLocales.length) {
                        applyConfirmedImport({
                            ...importConfirmation,
                            currentIndex: nextIndex,
                            confirmedLocaleIds: nextConfirmed,
                        })
                    } else {
                        setImportConfirmation({
                            ...importConfirmation,
                            currentIndex: nextIndex,
                            confirmedLocaleIds: nextConfirmed,
                        })
                    }
                }}
                replaceAll={() => {
                    const nextConfirmed = new Set(confirmedLocaleIds)
                    for (let i = currentIndex; i < confirmLocales.length; i++) {
                        const loc = confirmLocales[i]
                        if (loc) nextConfirmed.add(loc.id)
                    }
                    applyConfirmedImport({
                        ...importConfirmation,
                        currentIndex: confirmLocales.length,
                        confirmedLocaleIds: nextConfirmed,
                    })
                }}
            />
        )
    }

    return (
        <ConfigurationPage
            mode={mode}
            locales={locales}
            availableLocaleIds={availableLocaleIds}
            accessToken={accessToken}
            accessTokenState={accessTokenState}
            projectId={projectId}
            projectList={projectList}
            validateAccessToken={validateAccessToken}
            setProjectId={setProjectId}
            selectedLocaleIds={selectedLocaleIds}
            setSelectedLocaleIds={setSelectedLocaleIds}
            operationInProgress={operationInProgress}
            onSubmit={onSubmit}
        />
    )
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
    availableLocaleIds,
    accessToken,
    accessTokenState,
    projectId,
    projectList,
    validateAccessToken,
    setProjectId,
    selectedLocaleIds,
    setSelectedLocaleIds,
    operationInProgress,
    onSubmit,
}: {
    mode: "export" | "import"
    locales: readonly Locale[]
    availableLocaleIds: string[]
    accessToken: string
    accessTokenState: AccessTokenState
    projectId: number
    projectList: readonly Project[]
    validateAccessToken: (accessToken: string) => Promise<void>
    setProjectId: (projectId: number) => void
    selectedLocaleIds: LocaleIds
    setSelectedLocaleIds: (localeIds: LocaleIds) => void
    operationInProgress: boolean
    onSubmit: () => void
}) {
    const [accessTokenValue, setAccessTokenValue] = useState<string>(accessToken)
    const accessTokenInputRef = useRef<HTMLInputElement>(null)

    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")
    const hasSelectedLocales = selectedLocaleIds === ALL_LOCALES_ID || selectedLocaleIds.length > 0
    const canPerformAction =
        accessToken && projectId && hasSelectedLocales && (mode === "import" ? isAllowedToSetLocalizationData : true)
    const accessTokenValueHasChanged = accessTokenValue !== accessToken

    useEffect(() => {
        setAccessTokenValue(accessToken)
    }, [accessToken])

    function onProjectButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
        const rect = e.currentTarget.getBoundingClientRect()
        void framer.showContextMenu(
            [
                {
                    label: NO_PROJECT_PLACEHOLDER,
                    enabled: false,
                },
                ...projectList.map(p => ({
                    label: p.name,
                    checked: p.id === projectId,
                    onAction: () => {
                        setProjectId(p.id)
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

    function onLocaleButtonClick(e: React.MouseEvent<HTMLButtonElement>, localeId: string | null) {
        const rect = e.currentTarget.getBoundingClientRect()

        void framer.showContextMenu(
            [
                {
                    label: "All Locales",
                    checked: selectedLocaleIds === ALL_LOCALES_ID,
                    onAction: () => {
                        setSelectedLocaleIds(selectedLocaleIds === ALL_LOCALES_ID ? [] : ALL_LOCALES_ID)
                    },
                },
                {
                    type: "separator",
                },
                ...locales.map(locale => ({
                    label: locale.name,
                    secondaryLabel: locale.code,
                    checked: selectedLocaleIds.includes(locale.id),
                    enabled:
                        availableLocaleIds.includes(locale.id) &&
                        !(selectedLocaleIds === ALL_LOCALES_ID
                            ? false
                            : selectedLocaleIds.includes(locale.id) && locale.id !== localeId),
                    onAction: () => {
                        if (selectedLocaleIds === ALL_LOCALES_ID) {
                            setSelectedLocaleIds([locale.id])
                        } else {
                            if (selectedLocaleIds.includes(locale.id)) {
                                setSelectedLocaleIds(selectedLocaleIds.filter(id => id !== locale.id))
                            } else {
                                setSelectedLocaleIds([...selectedLocaleIds, locale.id])
                            }
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
        setSelectedLocaleIds(
            selectedLocaleIds === ALL_LOCALES_ID ? [] : selectedLocaleIds.filter(id => id !== localeId)
        )
    }

    return (
        <main>
            <hr />
            <div className={cx("controls-stack", operationInProgress && "disabled")}>
                <PropertyControl label="Token">
                    <div className={cx("access-token-input")}>
                        <input
                            ref={accessTokenInputRef}
                            type="text"
                            placeholder="Crowdin token…"
                            autoFocus={!accessToken}
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
                                void validateAccessToken(accessTokenValue)
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
                <PropertyControl label="Project" disabled={accessTokenState !== AccessTokenState.Valid}>
                    <button
                        type="button"
                        className="dropdown-button"
                        disabled={!accessToken || !projectList.length}
                        onClick={onProjectButtonClick}
                    >
                        {projectList.find(p => p.id === projectId)?.name ?? NO_PROJECT_PLACEHOLDER}
                        <div className="icon-button">
                            <ChevronDownIcon />
                        </div>
                    </button>
                </PropertyControl>
                <PropertyControl label="Locales" disabled={availableLocaleIds.length === 0}>
                    {availableLocaleIds.length === 0 ? (
                        <div className="locales-empty-state" />
                    ) : selectedLocaleIds === ALL_LOCALES_ID ? (
                        <button
                            className="dropdown-button"
                            onClick={e => {
                                onLocaleButtonClick(e, ALL_LOCALES_ID)
                            }}
                        >
                            All Locales
                            <div className="icon-button">
                                <ChevronDownIcon />
                            </div>
                        </button>
                    ) : (
                        <div className="button-stack">
                            {selectedLocaleIds.map(id => (
                                <button
                                    className="dropdown-button"
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
                            {selectedLocaleIds.length < availableLocaleIds.length && (
                                <button
                                    onClick={e => {
                                        onLocaleButtonClick(e, null)
                                    }}
                                >
                                    Add
                                </button>
                            )}
                        </div>
                    )}
                </PropertyControl>
            </div>
            <hr />
            <button
                className="framer-button-primary"
                disabled={!canPerformAction}
                onClick={onSubmit}
                title={!isAllowedToSetLocalizationData ? "Insufficient permissions" : undefined}
            >
                {operationInProgress ? (
                    <div className="framer-spinner" />
                ) : (
                    `${mode === "export" ? "Export" : "Import"} ${
                        (
                            selectedLocaleIds === ALL_LOCALES_ID ? availableLocaleIds.length : selectedLocaleIds.length
                        ) === 1
                            ? "Locale"
                            : "Locales"
                    }`
                )}
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

function ConfirmationModal({
    localeName,
    currentStep,
    totalSteps,
    remainingLocaleCount,
    skip,
    replace,
    replaceAll,
}: {
    localeName: string
    currentStep: number
    totalSteps: number
    remainingLocaleCount: number
    skip: () => void
    replace: () => void
    replaceAll: () => void
}) {
    const [allChecked, setAllChecked] = useState(false)

    return (
        <main>
            <hr />
            <div className="heading">
                <h1>Replace Locale{totalSteps === 1 ? "" : "s"}</h1>
                <span className="step-indicator">
                    {currentStep} / {totalSteps}
                </span>
            </div>
            <hr />
            <p>
                By importing you are going to override the existing locale <strong>"{localeName}"</strong>.
            </p>
            {totalSteps > 1 && (
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={e => {
                            setAllChecked(e.target.checked)
                        }}
                    />
                    <p>
                        All ({remainingLocaleCount} {remainingLocaleCount === 1 ? "locale" : "locales"})
                    </p>
                </label>
            )}
            <div className="button-row">
                <button onClick={skip}>Skip</button>
                <button onClick={allChecked ? replaceAll : replace} className="framer-button-primary">
                    Replace
                </button>
            </div>
        </main>
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
