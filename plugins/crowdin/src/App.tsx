import cx from "classnames"
import { framer, type Locale, type LocalizationData, useIsAllowedTo } from "framer-plugin"
import pLimit from "p-limit"
import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"
import {
    type CrowdinStorageResponse,
    createCrowdinClient,
    type Project,
    validateAccessTokenAndGetProjects,
} from "./crowdin"
import { Flag } from "./Flag"
import { CheckIcon, ChevronDownIcon, InfoIcon, LinkArrowIcon, XIcon } from "./Icons"
import { ConfirmationModal, CreateLocaleModal } from "./Modals"
import { Progress } from "./Progress"
import { useDynamicPluginHeight } from "./useDynamicPluginHeight"
import { parseLocaleCode } from "./utils"
import {
    createValuesBySourceFromXliff,
    ensureSourceFile,
    generateXliff,
    getProjectTargetLanguages,
    parseXliff,
    updateTranslation,
    uploadStorage,
} from "./xliff"

const NO_PROJECT_PLACEHOLDER = "Select…"
const ALL_LOCALES_ID = "__ALL_LOCALES__"

/** Crowdin allows 20 simultaneous API requests per account. Limit concurrent locale exports to stay under that. */
const CROWDIN_EXPORT_CONCURRENCY = 5

type LocaleIds = string[] | typeof ALL_LOCALES_ID

/** Locale-like entry for the import locale list (Crowdin target languages; may not exist in Framer yet). */
interface ImportDisplayLocale {
    id: string
    name: string
    code: string
}

interface ImportConfirmationState {
    locales: Locale[]
    valuesByLocale: Record<string, NonNullable<LocalizationData["valuesBySource"]>>
    currentIndex: number
    confirmedLocaleIds: Set<string>
    /** Locale codes (e.g. "en-US") user chose to create when shown CreateLocaleModal. */
    localesToCreate: string[]
}

enum AccessTokenState {
    None = "none",
    Valid = "valid",
    Invalid = "invalid",
    Loading = "loading",
}

export function App({ activeLocale, locales }: { activeLocale: Locale | null; locales: readonly Locale[] }) {
    const isAllowedToCreateLocale = useIsAllowedTo("createLocale")
    const [mode, setMode] = useState<"export" | "import" | null>(null)
    const [accessToken, setAccessToken] = useState<string>("")
    const [accessTokenState, setAccessTokenState] = useState<AccessTokenState>(AccessTokenState.None)
    const [projectList, setProjectList] = useState<readonly Project[]>([])
    const [projectId, setProjectId] = useState<number>(0)
    const [selectedLocaleIds, setSelectedLocaleIds] = useState<LocaleIds>(activeLocale ? [activeLocale.id] : [])
    const [availableLocaleIds, setAvailableLocaleIds] = useState<string[]>([])
    const [crowdinTargetLanguages, setCrowdinTargetLanguages] = useState<{ id: string; name: string }[]>([])
    const [crowdinTargetLanguageCount, setCrowdinTargetLanguageCount] = useState<number>(0)
    const [localesLoading, setLocalesLoading] = useState(false)
    const [operationInProgress, setOperationInProgress] = useState<boolean>(false)
    const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null)
    const [importConfirmation, setImportConfirmation] = useState<ImportConfirmationState | null>(null)
    const validatingAccessTokenRef = useRef<boolean>(false)

    const isNarrowUI =
        (mode === "export" && exportProgress !== null && exportProgress.total > 1) ||
        (mode === "import" && importConfirmation !== null)
    useDynamicPluginHeight({ width: isNarrowUI ? 280 : 300 })

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
                    void framer.setPluginData("projectId", null)
                }
                setAccessToken("")
                setProjectList([])
                setProjectId(0)
                setAccessTokenState(AccessTokenState.None)
                return
            }

            if (accessToken && framer.isAllowedTo("setPluginData")) {
                void framer.setPluginData("projectId", null)
            }

            validatingAccessTokenRef.current = true
            setAccessTokenState(AccessTokenState.Loading)

            try {
                const { isValid, projects } = await validateAccessTokenAndGetProjects(token)

                setAccessToken(token)

                if (isValid) {
                    setProjectList(projects ?? [])

                    const storedProjectIdRaw = projects?.length ? await framer.getPluginData("projectId") : null
                    const storedProjectId = storedProjectIdRaw ? Number.parseInt(storedProjectIdRaw, 10) : null
                    const projectIdFromStorage =
                        storedProjectId &&
                        Number.isFinite(storedProjectId) &&
                        projects?.some(p => p.id === storedProjectId)
                            ? storedProjectId
                            : null

                    if (projectIdFromStorage != null) {
                        setProjectId(projectIdFromStorage)
                    } else if (Array.isArray(projects) && projects.length === 1 && projects[0]?.id) {
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

    // Export: all Framer locales are available. Import: all Crowdin target locales are available.
    const effectiveAvailableLocaleIds = mode === "export" ? locales.map(locale => locale.id) : availableLocaleIds
    const localeIdsToSync = selectedLocaleIds === ALL_LOCALES_ID ? effectiveAvailableLocaleIds : selectedLocaleIds

    // For import: show all Crowdin target languages (Framer name when locale exists, else Crowdin name). Use Crowdin code as id.
    const importDisplayLocales: ImportDisplayLocale[] = crowdinTargetLanguages.map(ct => ({
        id: ct.id,
        name: locales.find(l => l.code === ct.id)?.name ?? ct.name,
        code: ct.id,
    }))
    const configurationLocales: readonly (Locale | ImportDisplayLocale)[] =
        mode === "import" ? importDisplayLocales : locales

    // When createLocale not allowed, new (non-Framer) locales cannot be selected in import mode.
    const disabledImportLocaleIds =
        mode === "import" && !isAllowedToCreateLocale
            ? availableLocaleIds.filter(id => !locales.some(l => l.code === id))
            : []

    // When switching to import, selection is by Crowdin code; if current selection is invalid, reset. When createLocale not allowed, default to existing locales only.
    useEffect(() => {
        if (
            mode === "import" &&
            availableLocaleIds.length > 0 &&
            selectedLocaleIds !== ALL_LOCALES_ID &&
            !selectedLocaleIds.every(id => availableLocaleIds.includes(id))
        ) {
            const targetIds = isAllowedToCreateLocale
                ? availableLocaleIds
                : availableLocaleIds.filter(id => locales.some(l => l.code === id))
            setSelectedLocaleIds(targetIds)
        }
    }, [mode, availableLocaleIds, selectedLocaleIds, isAllowedToCreateLocale, locales])

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
        const codesToSync = localeIdsToSync as string[]
        const valuesByLocale: Record<string, NonNullable<LocalizationData["valuesBySource"]>> = {}
        const allLocalesForParse: Locale[] = [
            ...locales,
            ...crowdinTargetLanguages
                .filter(ct => !locales.some(l => l.code === ct.id))
                .map(ct => ({ id: ct.id, name: ct.name, code: ct.id, slug: ct.id })),
        ]

        try {
            for (const code of codesToSync) {
                const exportRes = await client.translations.exportProjectTranslation(projectId, {
                    targetLanguageId: code,
                    format: "xliff",
                })
                const url = exportRes.data.url
                if (!url) {
                    framer.notify(`Crowdin export URL not found for ${code}`, {
                        variant: "error",
                    })
                    continue
                }
                const resp = await fetch(url)
                const fileContent = await resp.text()
                const { xliff, targetLocale } = parseXliff(fileContent, allLocalesForParse)
                const valuesBySource = await createValuesBySourceFromXliff(xliff, targetLocale)
                if (!valuesBySource) continue
                valuesByLocale[code] = valuesBySource
            }

            if (Object.keys(valuesByLocale).length === 0) {
                framer.notify("No translations could be fetched from Crowdin", {
                    variant: "error",
                })
                return
            }

            const withNewFlag = codesToSync
                .filter(code => code in valuesByLocale)
                .map(code => {
                    const fr = locales.find(l => l.code === code)
                    const ct = crowdinTargetLanguages.find(c => c.id === code)
                    if (!ct) return null
                    const locale = (fr ?? { id: ct.id, name: ct.name, code: ct.id, slug: ct.id }) as Locale
                    return { locale, isNew: !fr }
                })
                .filter((x): x is { locale: Locale; isNew: boolean } => x != null)
            const orderedLocales: Locale[] = [...withNewFlag]
                .sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1))
                .map(x => x.locale)
            setImportConfirmation({
                locales: orderedLocales,
                valuesByLocale,
                currentIndex: 0,
                confirmedLocaleIds: new Set(),
                localesToCreate: [],
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

    async function finishImportConfirmation(state: ImportConfirmationState) {
        if (state.confirmedLocaleIds.size === 0) {
            framer.notify("No locales selected for import", { variant: "info" })
            setImportConfirmation(null)
            return
        }
        let createdIdsByCode: Record<string, string> | undefined
        if (state.localesToCreate.length > 0 && isAllowedToCreateLocale) {
            setOperationInProgress(true)
            try {
                createdIdsByCode = {}
                for (const code of state.localesToCreate) {
                    const { language, region } = parseLocaleCode(code)
                    const crowdinName = crowdinTargetLanguages.find(ct => ct.id === code)?.name
                    const created = await framer.createLocale({
                        language,
                        ...(region && { region }),
                        ...(crowdinName && { name: crowdinName }),
                        draft: true,
                    })
                    createdIdsByCode[code] = created.id
                }
            } catch (error) {
                console.error("Error creating locales:", error)
                framer.notify(
                    `Failed to create locale(s): ${error instanceof Error ? error.message : "Unknown error"}`,
                    { variant: "error", durationMs: 10000 }
                )
                setOperationInProgress(false)
                return
            }
            setOperationInProgress(false)
        }
        applyConfirmedImport(state, createdIdsByCode)
    }

    function applyConfirmedImport(state: ImportConfirmationState, createdIdsByCode?: Record<string, string>) {
        if (state.confirmedLocaleIds.size === 0) {
            framer.notify("No locales selected for import", { variant: "info" })
            setImportConfirmation(null)
            return
        }

        const mergedValuesBySource: NonNullable<LocalizationData["valuesBySource"]> = {}
        let appliedCount = 0
        for (const confirmedLocaleId of state.confirmedLocaleIds) {
            const code = locales.find(l => l.id === confirmedLocaleId)?.code ?? confirmedLocaleId
            const localeValues = state.valuesByLocale[code]
            if (!localeValues) continue
            const framerLocale = createdIdsByCode?.[code]
                ? { id: createdIdsByCode[code], code, name: code, slug: code }
                : locales.find(l => l.code === code)
            if (!framerLocale) continue
            appliedCount++
            for (const sourceId of Object.keys(localeValues)) {
                const localeData = localeValues[sourceId]
                if (localeData) {
                    const val = Object.values(localeData)[0]
                    if (val) {
                        mergedValuesBySource[sourceId] ??= {}
                        mergedValuesBySource[sourceId][framerLocale.id] = val
                    }
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
                const count = appliedCount
                framer.notify(`Successfully imported ${count} locale${count === 1 ? "" : "s"} from Crowdin`, {
                    variant: "success",
                    durationMs: 5000,
                })
            })
            .catch((error: unknown) => {
                console.error("Error applying import:", error)
                framer.notify(`Import error: ${error instanceof Error ? error.message : "An unknown error occurred"}`, {
                    variant: "error",
                    durationMs: 10000,
                })
            })
            .finally(() => {
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

        // Show progress bar if exporting multiple locales
        if (localesToSync.length > 1) {
            setExportProgress({ current: 0, total: localesToSync.length })
        }

        try {
            const groups = await framer.getLocalizationGroups()
            const defaultLocale = await framer.getDefaultLocale()
            const sourceFilename = `framer-source-${defaultLocale.code}.xliff`
            const fileId = await ensureSourceFile(sourceFilename, projectId, accessToken, defaultLocale, groups)

            const limit = pLimit(CROWDIN_EXPORT_CONCURRENCY)
            const exportLocale = async (locale: Locale) => {
                const xliffContent = generateXliff(defaultLocale, locale, groups)
                const filename = `translations-${locale.code}.xliff`

                const storageRes = await uploadStorage(xliffContent, accessToken, filename)
                if (!storageRes.ok) {
                    framer.notify(`Failed to upload ${locale.code} to Crowdin storage`, {
                        variant: "error",
                    })
                    return
                }
                const storageData = (await storageRes.json()) as CrowdinStorageResponse
                const storageId = storageData.data.id

                const uploadResult = await updateTranslation(projectId, storageId, fileId, accessToken, locale)
                if (!uploadResult.ok) {
                    framer.notify(
                        `Crowdin upload failed for ${locale.code}: ${uploadResult.errorMessage ?? "Unknown error"}`,
                        { variant: "error" }
                    )
                }

                setExportProgress(prev => (prev ? { ...prev, current: Math.min(prev.current + 1, prev.total) } : prev))
            }

            await Promise.all(localesToSync.map(locale => limit(() => exportLocale(locale))))

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
            setExportProgress(null)
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

    const handleSetProjectId = useCallback((id: number) => {
        setProjectId(id)
        if (framer.isAllowedTo("setPluginData")) {
            void framer.setPluginData("projectId", id ? String(id) : null)
        }
    }, [])

    // Fetch Crowdin project target languages when project is selected
    useEffect(() => {
        if (!projectId || !accessToken || accessTokenState !== AccessTokenState.Valid) {
            setAvailableLocaleIds([])
            setCrowdinTargetLanguageCount(0)
            setSelectedLocaleIds([])
            setLocalesLoading(false)
            return
        }

        setAvailableLocaleIds([])
        setSelectedLocaleIds([])
        setCrowdinTargetLanguages([])
        setLocalesLoading(true)

        let cancelled = false
        const task = async () => {
            let targetLanguages: { id: string; name: string }[] = []
            try {
                const list = await getProjectTargetLanguages(projectId, accessToken)
                if (!cancelled) {
                    targetLanguages = list
                    setCrowdinTargetLanguageCount(list.length)
                }
            } catch {
                if (!cancelled) {
                    targetLanguages = []
                    setCrowdinTargetLanguageCount(0)
                }
            } finally {
                if (!cancelled) {
                    setLocalesLoading(false)
                }
            }

            if (!cancelled) {
                const targetLanguageIds = targetLanguages.map(t => t.id)
                setCrowdinTargetLanguages(targetLanguages)
                setAvailableLocaleIds(targetLanguageIds)
                const exportAvailableLocaleIds = locales
                    .filter(locale => targetLanguageIds.includes(locale.code))
                    .map(locale => locale.id)
                setSelectedLocaleIds(exportAvailableLocaleIds)
            }
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
        return <Home setMode={setMode} locales={locales} />
    }

    if (mode === "import" && importConfirmation) {
        const { locales: confirmLocales, currentIndex, confirmedLocaleIds } = importConfirmation
        const currentLocale = confirmLocales[currentIndex]
        const remainingCount = confirmLocales.length - currentIndex
        const remainingExistingLocaleCount = confirmLocales
            .slice(currentIndex)
            .filter(loc => locales.some(l => l.code === loc.code)).length
        const isNewLocale = currentLocale != null && !locales.some(l => l.code === currentLocale.code)

        const goToNext = () => {
            const nextIndex = currentIndex + 1
            if (nextIndex >= confirmLocales.length) {
                void finishImportConfirmation({ ...importConfirmation, currentIndex: nextIndex })
            } else {
                setImportConfirmation({ ...importConfirmation, currentIndex: nextIndex })
            }
        }

        if (isNewLocale) {
            return (
                <CreateLocaleModal
                    localeCode={currentLocale.code}
                    currentStep={currentIndex + 1}
                    totalSteps={confirmLocales.length}
                    onSkip={goToNext}
                    onAdd={() => {
                        const nextConfirmed = new Set(confirmedLocaleIds)
                        nextConfirmed.add(currentLocale.id)
                        const nextLocalesToCreate = [...importConfirmation.localesToCreate, currentLocale.code]
                        const nextIndex = currentIndex + 1
                        const nextState: ImportConfirmationState = {
                            ...importConfirmation,
                            currentIndex: nextIndex,
                            confirmedLocaleIds: nextConfirmed,
                            localesToCreate: nextLocalesToCreate,
                        }
                        if (nextIndex >= confirmLocales.length) {
                            void finishImportConfirmation(nextState)
                        } else {
                            setImportConfirmation(nextState)
                        }
                    }}
                />
            )
        }

        return (
            <ConfirmationModal
                localeName={currentLocale?.name ?? ""}
                currentStep={currentIndex + 1}
                totalSteps={confirmLocales.length}
                remainingLocaleCount={remainingCount}
                remainingExistingLocaleCount={remainingExistingLocaleCount}
                skip={goToNext}
                update={() => {
                    const nextConfirmed = new Set(confirmedLocaleIds)
                    if (currentLocale) nextConfirmed.add(currentLocale.id)
                    const nextIndex = currentIndex + 1
                    if (nextIndex >= confirmLocales.length) {
                        void finishImportConfirmation({
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
                updateAll={() => {
                    const nextConfirmed = new Set(confirmedLocaleIds)
                    for (let i = currentIndex; i < confirmLocales.length; i++) {
                        const loc = confirmLocales[i]
                        if (loc) nextConfirmed.add(loc.id)
                    }
                    void finishImportConfirmation({
                        ...importConfirmation,
                        currentIndex: confirmLocales.length,
                        confirmedLocaleIds: nextConfirmed,
                    })
                }}
            />
        )
    }

    if (mode === "export" && exportProgress && exportProgress.total > 1) {
        return <Progress current={exportProgress.current} total={exportProgress.total} />
    }

    return (
        <Configuration
            mode={mode}
            locales={configurationLocales}
            availableLocaleIds={effectiveAvailableLocaleIds}
            disabledImportLocaleIds={disabledImportLocaleIds}
            crowdinTargetLanguageCount={crowdinTargetLanguageCount}
            localesLoading={localesLoading}
            accessToken={accessToken}
            accessTokenState={accessTokenState}
            projectId={projectId}
            projectList={projectList}
            validateAccessToken={validateAccessToken}
            setProjectId={handleSetProjectId}
            selectedLocaleIds={selectedLocaleIds}
            setSelectedLocaleIds={setSelectedLocaleIds}
            operationInProgress={operationInProgress}
            onSubmit={onSubmit}
        />
    )
}

function Home({ setMode, locales }: { setMode: (mode: "export" | "import") => void; locales: readonly Locale[] }) {
    const isAllowedToSetLocalizationData = useIsAllowedTo("setLocalizationData")
    const hasLocales = locales.length > 0

    return (
        <main className="home">
            <hr />
            <div className="hero">
                <div className="logo">
                    <img src="/icon.svg" alt="Crowdin Logo" />
                </div>
                <h1>Translate with Crowdin</h1>
                <p>Enter your access token from Crowdin and select a project to sync locales.</p>
            </div>
            <div className="button-row">
                <button
                    onClick={() => {
                        setMode("export")
                    }}
                    disabled={!hasLocales}
                    title={!hasLocales ? "No locales in project" : undefined}
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

function Configuration({
    mode,
    locales,
    availableLocaleIds,
    disabledImportLocaleIds = [],
    crowdinTargetLanguageCount,
    localesLoading,
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
    locales: readonly (Locale | ImportDisplayLocale)[]
    availableLocaleIds: string[]
    disabledImportLocaleIds?: string[]
    crowdinTargetLanguageCount: number
    localesLoading: boolean
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
    const selectableLocaleIds =
        disabledImportLocaleIds.length > 0
            ? availableLocaleIds.filter(id => !disabledImportLocaleIds.includes(id))
            : availableLocaleIds
    const isAllSelectableSelected =
        selectableLocaleIds.length > 0 &&
        selectableLocaleIds.every(id => selectedLocaleIds.includes(id)) &&
        (selectedLocaleIds === ALL_LOCALES_ID || selectedLocaleIds.length === selectableLocaleIds.length)
    const hasSelectedLocales = selectedLocaleIds === ALL_LOCALES_ID || selectedLocaleIds.length > 0
    const hasLocalesForMode = mode === "export" ? availableLocaleIds.length > 0 : true
    const localesDisabled = !accessToken || !projectId
    const canPerformAction =
        accessToken &&
        projectId &&
        hasLocalesForMode &&
        hasSelectedLocales &&
        (mode === "import" ? isAllowedToSetLocalizationData : true)
    const accessTokenValueHasChanged = accessTokenValue !== accessToken

    useEffect(() => {
        setAccessTokenValue(accessToken)
    }, [accessToken])

    function onProjectButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
        const rect = e.currentTarget.getBoundingClientRect()
        void framer.showContextMenu(
            [
                {
                    label: "Select project…",
                    enabled: false,
                },
                {
                    type: "separator",
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
        const localeDisabled = (id: string) => disabledImportLocaleIds.includes(id)

        void framer.showContextMenu(
            [
                {
                    label: "All Locales",
                    checked:
                        disabledImportLocaleIds.length > 0
                            ? isAllSelectableSelected
                            : selectedLocaleIds === ALL_LOCALES_ID,
                    onAction: () => {
                        if (disabledImportLocaleIds.length > 0) {
                            setSelectedLocaleIds(isAllSelectableSelected ? [] : [...selectableLocaleIds])
                        } else {
                            setSelectedLocaleIds(selectedLocaleIds === ALL_LOCALES_ID ? [] : ALL_LOCALES_ID)
                        }
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
                        !localeDisabled(locale.id) &&
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
                    <div className="access-token-input">
                        <input
                            ref={accessTokenInputRef}
                            type="text"
                            placeholder="Crowdin token…"
                            autoComplete="off"
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
                        {accessTokenState === AccessTokenState.None && !accessTokenValueHasChanged && (
                            <a
                                href="https://crowdin.com/settings#api-key"
                                target="_blank"
                                className="icon-button link-icon"
                                title="Open Crowdin settings"
                            >
                                <LinkArrowIcon />
                            </a>
                        )}
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
                <PropertyControl label="Project">
                    <button
                        type="button"
                        className="dropdown-button"
                        disabled={!accessToken || !projectList.length}
                        onClick={onProjectButtonClick}
                    >
                        <span>{projectList.find(p => p.id === projectId)?.name ?? NO_PROJECT_PLACEHOLDER}</span>
                        <div className="icon-button">
                            <ChevronDownIcon />
                        </div>
                    </button>
                </PropertyControl>
                <PropertyControl label="Locales">
                    {localesDisabled || localesLoading || availableLocaleIds.length === 0 ? (
                        <div className={cx("locales-empty-state", localesLoading && "loading")}>
                            {localesLoading ? (
                                <div className="framer-spinner" />
                            ) : (
                                <>
                                    Select…
                                    <div className="icon-button">
                                        <ChevronDownIcon />
                                    </div>
                                </>
                            )}
                        </div>
                    ) : selectedLocaleIds === ALL_LOCALES_ID ? (
                        <button
                            className="dropdown-button"
                            disabled={localesDisabled}
                            onClick={e => {
                                onLocaleButtonClick(e, ALL_LOCALES_ID)
                            }}
                        >
                            <span>All Locales</span>
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
                                    disabled={localesDisabled}
                                    onClick={e => {
                                        onLocaleButtonClick(e, id)
                                    }}
                                >
                                    <div className="content">
                                        <Flag code={locales.find(locale => locale.id === id)?.code ?? id} />
                                        <span>{locales.find(locale => locale.id === id)?.name ?? id}</span>
                                    </div>
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
                                    disabled={localesDisabled}
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
            {accessToken && projectId !== 0 && availableLocaleIds.length === 0 ? (
                <div className="no-locales-message">
                    <InfoIcon />
                    {crowdinTargetLanguageCount === 0 ? "No locales found in Crowdin" : "No matching locales in Framer"}
                </div>
            ) : (
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
                                selectedLocaleIds === ALL_LOCALES_ID
                                    ? availableLocaleIds.length
                                    : selectedLocaleIds.length
                            ) === 1
                                ? "Locale"
                                : "Locales"
                        }`
                    )}
                </button>
            )}
        </main>
    )
}

function PropertyControl({ label, children }: { label: string; children: React.ReactNode | React.ReactNode[] }) {
    return (
        <div className="property-control">
            <p>{label}</p>
            <div className="content">{children}</div>
        </div>
    )
}
