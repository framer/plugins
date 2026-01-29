export function OldApp() {
    const [isLoading, setIsLoading] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)

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
