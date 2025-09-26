import type { Collection, CollectionItem, CollectionItemInput, Field } from "framer-plugin"
import { framer } from "framer-plugin"
import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import "./App.css"
import splashImageSrc from "./assets/splash.png"
import { PreviewTable } from "./PreviewTable"
import { buildFieldDataForItem, buildReferenceSlugMap, readRawFieldValue } from "./sync"

interface FieldOption {
    id: string
    name: string
    type: string
}

interface SyncStats {
    scanned: number
    skipped: number
    added: number
    errors: number
}

interface PreviewPlan {
    scanned: number
    skipped: number
    toAdd: number
    slugs: string[]
}

interface ProgressState { b: number; bt: number; n: number; N: number } // batch, batchTotal, itemsDone, itemsTotal
type ConflictPolicy = "skip" | "update"

/** storage helpers (scoped keys) */
const storageKey = (srcId: string, dstId: string) => `cms-sync:mapping:${srcId}->${dstId}`
const storageGet = (srcId: string, dstId: string) => {
    try {
        const raw = window.localStorage.getItem(storageKey(srcId, dstId))
        return raw
            ? (JSON.parse(raw) as {
                  mapping: Record<string, string | undefined>
                  slugSource?: string
                  conflictPolicy?: ConflictPolicy
              })
            : null
    } catch {
        return null
    }
}
const storageSet = (
    srcId: string,
    dstId: string,
    value: { mapping: Record<string, string | undefined>; slugSource?: string; conflictPolicy?: ConflictPolicy }
) => {
    try {
        window.localStorage.setItem(storageKey(srcId, dstId), JSON.stringify(value))
    } catch {
        /* ignore */
    }
}

export function App() {
    const [isLoading, setIsLoading] = useState(true)
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
    const [destinationCollection, setDestinationCollection] = useState<Collection | null>(null)

    const [srcFields, setSrcFields] = useState<FieldOption[]>([])
    const [dstFields, setDstFields] = useState<FieldOption[]>([])
    const [mapping, setMapping] = useState<Record<string, string | undefined>>({})
    const [slugSource, setSlugSource] = useState<string>("__auto__")
    const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>("skip")
    const [loadingFields, setLoadingFields] = useState(false)

    const [syncLoading, setSyncLoading] = useState(false)
    const [stats, setStats] = useState<SyncStats | null>(null)

    // Preview (dry-run)
    const [preview, setPreview] = useState<PreviewPlan | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [showPreviewModal, setShowPreviewModal] = useState(false)

    // Progress bar (batch X/Y)
    const [progress, setProgress] = useState<ProgressState | null>(null)

    useEffect(() => {
        // Wider UI so the mapper has breathing room (no horizontal scroll)
        void framer.showUI({ width: 560, height: 680, resizable: false })
        const task = async () => {
            const [cols, active] = await Promise.all([framer.getCollections(), framer.getActiveCollection()])
            setIsLoading(false)
            setCollections(cols)
            setSelectedCollection(active)
        }
        void task()
    }, [])

    const resetMapper = () => {
        setSrcFields([])
        setDstFields([])
        setMapping({})
        setSlugSource("__auto__")
        setConflictPolicy("skip")
        setStats(null)
        setPreview(null)
        setShowPreviewModal(false)
        setProgress(null)
    }

    const selectCollection = (e: ChangeEvent<HTMLSelectElement>) => {
        const col = collections.find(c => c.id === e.currentTarget.value)
        if (!col) return
        setSelectedCollection(col)
        resetMapper()
    }

    const selectDestinationCollection = (e: ChangeEvent<HTMLSelectElement>) => {
        const col = collections.find(c => c.id === e.currentTarget.value)
        if (!col) return
        setDestinationCollection(col)
        resetMapper()
    }

    const loadFieldsForMapper = () => {
        if (!selectedCollection || !destinationCollection) {
            framer.notify("Pick both Source and Destination first", { variant: "warning" })
            return
        }
        const task = async () => {
            setLoadingFields(true)
            try {
                const [sFields, dFields] = await Promise.all([selectedCollection.getFields(), destinationCollection.getFields()])

                const toOpt = (f: unknown): FieldOption => {
                    const obj = f as { id: string; name: string; type: string }
                    return { id: obj.id, name: obj.name, type: obj.type }
                }
                const srcOpts = sFields.map(toOpt)
                const dstOpts = dFields.map(toOpt)
                setSrcFields(srcOpts)
                setDstFields(dstOpts)

                // try restore saved mapping for this pair; otherwise naive default by name (type-aware)
                const saved = storageGet(selectedCollection.id, destinationCollection.id)
                if (saved) {
                    const filtered: Record<string, string | undefined> = {}
                    const dstIds = new Set(dstOpts.map(d => d.id))
                    for (const [k, v] of Object.entries(saved.mapping)) if (dstIds.has(k)) filtered[k] = v
                    setMapping(filtered)
                    setSlugSource(saved.slugSource ?? "__auto__")
                    setConflictPolicy(saved.conflictPolicy ?? "skip")
                } else {
                    const fm: Record<string, string | undefined> = {}
                    for (const df of dstOpts) {
                        const exact = srcOpts.find(sf => sf.name.toLowerCase() === df.name.toLowerCase() && sf.type === df.type)
                        const byName = exact ?? srcOpts.find(sf => sf.name.toLowerCase() === df.name.toLowerCase())
                        fm[df.id] = byName?.id
                    }
                    setMapping(fm)
                    setSlugSource("__auto__")
                    setConflictPolicy("skip")
                }

                setStats(null)
                setPreview(null)
                setShowPreviewModal(false)
                setProgress(null)
            } catch (e) {
                console.error(e)
                framer.notify("Failed to load fields for mapper", { variant: "error" })
            } finally {
                setLoadingFields(false)
            }
        }
        void task()
    }

    const slugify = (s: string) =>
        s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 120)

    // no-any helper for slug extraction
    const rawToStringForSlug = (raw: unknown): string => {
        if (typeof raw === "string") return raw
        if (typeof raw === "number" || typeof raw === "boolean") return String(raw)
        if (typeof raw === "object" && raw !== null) {
            const r = raw as Record<string, unknown>
            if (typeof r.value === "string") return r.value
            if (typeof r.text === "string") return r.text
        }
        return ""
    }

    // shared helper for slug in preview/sync
    const computeSlug = (it: CollectionItem, srcForSlug: string) => {
        let slug: string
        if (srcForSlug === "__auto__") {
            slug = it.slug || `synced-${it.id}`
        } else {
            const raw = readRawFieldValue(it, srcForSlug)
            const s = rawToStringForSlug(raw)
            slug = s || it.slug || `synced-${it.id}`
        }
        return slugify(slug)
    }

    const ensureWritePermission = async (): Promise<boolean> => {
        const api = framer as unknown as {
            hasPermission?: (perm: string) => Promise<boolean>
            requestPermissions?: (perms: string[]) => Promise<void>
        }
        try {
            if (api.hasPermission) {
                const has = await api.hasPermission("cms:write")
                if (has) return true
            }
            if (api.requestPermissions) {
                await api.requestPermissions(["cms:write"])
                return true
            }
        } catch {
            /* ignore */
        }
        return true
    }

    // PREVIEW (no writes) — opens a modal listing all slugs to be added
    const previewSync = () => {
        if (!selectedCollection || !destinationCollection) {
            framer.notify("Choose Source and Destination, then Load fields.", { variant: "warning" })
            return
        }
        if (dstFields.length === 0 || srcFields.length === 0) {
            framer.notify("Click ‘Load fields’ before preview.", { variant: "warning" })
            return
        }

        const task = async () => {
            setPreview(null)
            setPreviewLoading(true)
            setShowPreviewModal(false)
            try {
                const [srcItems, dstItems, dstDefs, srcDefs] = await Promise.all([
                    selectedCollection.getItems(),
                    destinationCollection.getItems(),
                    destinationCollection.getFields(),
                    selectedCollection.getFields(),
                ])

                const refSlugMap = await buildReferenceSlugMap(dstDefs)
                const existing = new Set<string>(dstItems.map((i: CollectionItem) => i.slug))
                const srcFieldMap = new Map<string, Field>(srcDefs.map(f => [f.id, f]))

                let scanned = 0,
                    skipped = 0,
                    toAdd = 0
                const slugs: string[] = []

                for (const it of srcItems) {
                    scanned++

                    const slug = computeSlug(it, slugSource)
                    // NOTE: conflict policy future hook — for now, always skip when exists
                    if (!slug || existing.has(slug)) {
                        skipped++
                        continue
                    }

                    // Validate mapping/refs would succeed (throws early if bad)
                    void buildFieldDataForItem(dstDefs, mapping, it, srcFieldMap, refSlugMap)

                    toAdd++
                    slugs.push(slug)
                }

                setPreview({ scanned, skipped, toAdd, slugs })
                setShowPreviewModal(true)
            } catch (error) {
                console.error("Preview failed:", error)
                framer.notify("Preview failed — check mapping and field types.", { variant: "error" })
            } finally {
                setPreviewLoading(false)
            }
        }

        void task()
    }

    const syncNow = () => {
        if (!selectedCollection || !destinationCollection) {
            framer.notify("Choose Source and Destination, then Load fields.", { variant: "warning" })
            return
        }
        if (dstFields.length === 0 || srcFields.length === 0) {
            framer.notify("Click ‘Load fields’ before syncing.", { variant: "warning" })
            return
        }

        const task = async () => {
            setSyncLoading(true)
            setStats(null)
            setProgress(null)
            try {
                const ok = await ensureWritePermission()
                if (!ok) {
                    framer.notify("Permission denied: cms:write", { variant: "error" })
                    setSyncLoading(false)
                    return
                }

                const [srcItems, dstItems, dstDefs, srcDefs] = await Promise.all([
                    selectedCollection.getItems(),
                    destinationCollection.getItems(),
                    destinationCollection.getFields(),
                    selectedCollection.getFields(),
                ])

                // Build slug->id map for referenced collections in destination
                const refSlugMap = await buildReferenceSlugMap(dstDefs)

                const existing = new Set<string>(dstItems.map((i: CollectionItem) => i.slug))
                const srcFieldMap = new Map<string, Field>(srcDefs.map(f => [f.id, f]))

                // --------- pre-pass to compute total items & batches for progress ---------
                let preToAdd = 0
                for (const it of srcItems) {
                    const slug = computeSlug(it, slugSource)
                    // NOTE: conflict policy future hook — for now, always skip when exists
                    if (!slug || existing.has(slug)) continue
                    void buildFieldDataForItem(dstDefs, mapping, it, srcFieldMap, refSlugMap)
                    preToAdd++
                }
                const BATCH_SIZE = 50
                const totalBatches = Math.ceil(preToAdd / BATCH_SIZE)
                if (preToAdd > 0) setProgress({ b: 0, bt: totalBatches, n: 0, N: preToAdd })

                // --------- existing sync loop (append-only) ---------
                let scanned = 0,
                    skipped = 0,
                    added = 0,
                    errors = 0
                const batch: CollectionItemInput[] = []
                let batchIndex = 0

                const flush = async () => {
                    if (!batch.length) return
                    const toSend = batch.splice(0, batch.length)

                    // update progress BEFORE network call
                    setProgress(p => (p ? { ...p, b: Math.min(batchIndex + 1, p.bt), n: Math.min(p.n + toSend.length, p.N) } : p))

                    try {
                        await destinationCollection.addItems(toSend)
                        toSend.forEach(b => {
                            if (b.slug) existing.add(b.slug)
                        })
                        added += toSend.length
                    } catch (e) {
                        console.error("Batch add failed", e)
                        errors++
                    } finally {
                        batchIndex++
                    }
                }

                for (const it of srcItems) {
                    scanned++

                    // Slug
                    const slug = computeSlug(it, slugSource)
                    // NOTE: conflict policy future hook — for now, always skip when exists
                    if (!slug || existing.has(slug)) {
                        skipped++
                        continue
                    }

                    // FieldData – with collection reference conversions via refSlugMap
                    const fieldData = buildFieldDataForItem(dstDefs, mapping, it, srcFieldMap, refSlugMap)

                    // New items: do not include `id`
                    batch.push({ slug, fieldData })

                    if (batch.length >= BATCH_SIZE) {
                        await flush()
                    }
                }

                if (batch.length) {
                    await flush()
                }

                setStats({ scanned, skipped, added, errors })
                setProgress(null) // hide bar at the end

                framer.notify(`Sync complete: +${added}, skipped ${skipped}`, {
                    variant: errors ? "warning" : "success",
                })

                // save the current mapping for this pair (now includes policy)
                storageSet(selectedCollection.id, destinationCollection.id, { mapping, slugSource, conflictPolicy })
            } catch (error) {
                console.error("Sync failed:", error)
                framer.notify("Sync failed — check mapping and field types.", { variant: "error" })
            } finally {
                setSyncLoading(false)
            }
        }

        void task()
    }

    // ---------- derived ----------
    const unmapped = useMemo(
        () => dstFields.filter(df => !mapping[df.id]).map(df => df.name),
        [dstFields, mapping]
    )

    return (
        <div className="export-collection">
            {/* Modal Overlay for Preview */}
            {showPreviewModal && preview && (
                <div className="modalOverlay" role="dialog" aria-modal="true">
                    <div className="modalPanel">
                        <div className="modalHeader">
                            Preview — Items to be added ({preview.toAdd})
                        </div>

                        <div className="modalBody">
                            <div className="modalMeta">
                                <span>Scanned: <b>{preview.scanned}</b></span>
                                <span>Skipped: <b>{preview.skipped}</b></span>
                                <span>To add: <b>{preview.toAdd}</b></span>
                            </div>

                            <div className="slugsBox">
                                <div className="slugsHead">Slugs</div>
                                <div className="slugsScroll">
                                    {preview.slugs.length === 0 ? (
                                        <div className="slugsEmpty">No new items will be created.</div>
                                    ) : (
                                        <ol className="slugsList">
                                            {preview.slugs.map((s, i) => (
                                                <li key={`${s}-${i}`} className="slugsListItem" title={s}>
                                                    {s}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modalFooter">
                            <button className="button" onClick={() => { setShowPreviewModal(false); }} style={{ minWidth: 88 }}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="preview-container">
                <div className={`preview-container-image ${!selectedCollection && !isLoading ? "visible" : ""}`}>
                    <div className="empty-state">
                        <img className="empty-state-image" src={splashImageSrc} alt="" />
                        <p className="empty-state-message">Sync CMS content between collections.</p>
                    </div>
                </div>

                <div className={`preview-container-table ${selectedCollection ? "visible" : ""}`}>
                    {selectedCollection && <PreviewTable collection={selectedCollection} />}
                </div>
            </div>

            <div className="footer">
                <div className="panel">
                    <div className="panelHeader">Source (any collection)</div>
                    <select
                        onChange={selectCollection}
                        className={!selectedCollection ? "footer-select footer-select--unselected" : "footer-select"}
                        value={selectedCollection?.id ?? ""}
                    >
                        <option value="" disabled>
                            Select Source…
                        </option>
                        {collections.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="panel" style={{ marginTop: 8 }}>
                    <div className="panelHeader">Destination (any collection)</div>
                    <select
                        onChange={selectDestinationCollection}
                        className={!destinationCollection ? "footer-select footer-select--unselected" : "footer-select"}
                        value={destinationCollection?.id ?? ""}
                    >
                        <option value="" disabled>
                            Select Destination…
                        </option>
                        {collections.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="panel" style={{ marginTop: 8 }}>
                    <button
                        className="button"
                        style={{ width: "100%" }}
                        onClick={loadFieldsForMapper}
                        disabled={!selectedCollection || !destinationCollection || loadingFields}
                    >
                        {loadingFields ? "Loading fields…" : "Load fields"}
                    </button>
                </div>

                <div className="panel" style={{ marginTop: 8 }}>
                    <div className="panelHeader">Field Mapper</div>

                    {srcFields.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                            <div className="hint" style={{ marginBottom: 6, fontWeight: 600 }}>
                                Slug <span className="hint">(use source slug or derive from a field)</span>
                            </div>
                            <select
                                className="footer-select"
                                value={slugSource}
                                onChange={e => {
                                    setSlugSource(e.target.value)
                                }}
                            >
                                <option value="__auto__">Use existing / auto-generate</option>
                                {srcFields.map(sf => (
                                    <option key={sf.id} value={sf.id}>
                                        {sf.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* preflight banner: unmapped destination fields */}
                    {dstFields.length > 0 && unmapped.length > 0 && (
                        <div className="preflight">
                            <div className="preflight-title">Unmapped fields:</div>
                            <div className="preflight-list" title={unmapped.join(", ")}>
                                {unmapped.slice(0, 4).join(", ")}
                                {unmapped.length > 4 ? ` +${unmapped.length - 4} more` : ""}
                            </div>
                        </div>
                    )}

                    {dstFields.length > 0 && (
                        <div className="mapperGrid">
                            {/* Source | Destination */}
                            <div className="mapperHead">Source</div>
                            <div className="mapperHead">Destination</div>

                            {dstFields.map(df => {
                                const mappedId = mapping[df.id]
                                const srcType = mappedId ? srcFields.find(sf => sf.id === mappedId)?.type : undefined
                                const mismatch = !!(srcType && srcType !== df.type)
                                return (
                                    <div className="mapperRow" key={df.id}>
                                        {/* Source (dropdown) */}
                                        <div className={`mapperSrc ${mismatch ? "mismatchCell" : ""}`}>
                                            <select
                                                className={`footer-select ${mismatch ? "selectWarn" : ""}`}
                                                value={mapping[df.id] ?? ""}
                                                onChange={e => {
                                                    setMapping(m => ({ ...m, [df.id]: e.target.value || undefined }))
                                                }}
                                            >
                                                <option value="">— do not map —</option>
                                                {srcFields.map(sf => (
                                                    <option key={sf.id} value={sf.id}>
                                                        {sf.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Destination (label + badge) */}
                                        <div className={`mapperDest ${mismatch ? "mismatchCell" : ""}`}>
                                            <span className="mapperDestLabel" title={`${df.name} (${df.type})`}>
                                                {df.name}
                                            </span>
                                            {mismatch && (
                                                <span className="typeBadge" title={`Mapped types do not match: ${srcType} → ${df.type}`}>
                                                    {srcType} → {df.type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Conflict policy (UI only for now; behavior is Skip) */}
                    <div className="conflictPanel">
                        <div className="conflictTitle">When slug already exists</div>
                        <div className="conflictGroup">
                            <label className="conflictOption">
                                <input
                                    type="radio"
                                    name="conflict"
                                    checked={conflictPolicy === "skip"}
                                    onChange={() => { setConflictPolicy("skip"); }}
                                />
                                <span>Skip if slug exists</span>
                            </label>

                            <label className="conflictOption conflictDisabled" title="Coming soon">
                                <input type="radio" name="conflict" disabled />
                                <span>Update existing (coming soon)</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <div className="inlineActions">
                            <button
                                className="button"
                                onClick={previewSync}
                                disabled={
                                    !selectedCollection ||
                                    !destinationCollection ||
                                    dstFields.length === 0 ||
                                    previewLoading ||
                                    syncLoading
                                }
                            >
                                {previewLoading ? "Previewing…" : "Preview"}
                            </button>

                            <button
                                className="button"
                                onClick={syncNow}
                                disabled={!selectedCollection || !destinationCollection || dstFields.length === 0 || syncLoading}
                            >
                                {syncLoading ? "Syncing…" : "Sync"}
                            </button>
                        </div>

                        {/* progress bar */}
                        {progress && (
                            <div className="progressBar">
                                <div className="progressTrack">
                                    <div
                                        className="progressFill"
                                        style={{
                                            width: `${progress.N === 0 ? 0 : Math.round((progress.n / progress.N) * 100)}%`,
                                        }}
                                    />
                                </div>
                                <div className="progressMeta">
                                    Batch {progress.b}/{progress.bt} · {progress.n}/{progress.N}
                                </div>
                            </div>
                        )}

                        {/* inline preview summary */}
                        {preview && !showPreviewModal && (
                            <div className="previewBox">
                                <div>
                                    Preview plan → Scanned: <b>{preview.scanned}</b>, Skipped: <b>{preview.skipped}</b>, To add: <b>{preview.toAdd}</b>
                                </div>
                            </div>
                        )}
                    </div>

                    {stats && (
                        <div className="statsRow">
                            <div>
                                Scanned: <b>{stats.scanned}</b>
                            </div>
                            <div>
                                Skipped: <b>{stats.skipped}</b>
                            </div>
                            <div>
                                Added: <b>{stats.added}</b>
                            </div>
                            <div>
                                Errors: <b>{stats.errors}</b>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}