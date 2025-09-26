# cms-sync (Framer Plugin)

Sync content **from any CMS collection to any other** inside Framer — managed or unmanaged.  
Built for reliability, minimal setup, and clear, confidence-building feedback.

---

## ✨ What it does

- **Browse collections** and pick a **Source** and **Destination**
- **Load fields** and map them in a clean two-column grid (Source → Destination)
- **Slug control**: use existing slugs or derive from a source field
- **Dry-run preview**: see exactly what would be added (no writes)
- **Append-only sync**: copy new items in batches
- **Progress bar** during batching (e.g., `Batch 2/7 · 100/350`)
- **Type mismatch badges** and soft row highlights in the mapper
- **Stats** after sync (`Scanned`, `Skipped`, `Added`, `Errors`)
- **Saved mappings**: persists per (source → destination) pair
- **Image/File handling**: robust URL/ID/value mappings + `alt` support
- **Reference fields**: maps slugs → IDs across `CollectionReference` and `MultiCollectionReference`
- **Permissions-aware**: requests `cms:write` only when needed

> ✅ Current behavior is **append-only**. If a slug already exists in the destination, it’s **skipped**.

---

## 🔧 Requirements

- Framer (with CMS)
- Permission to read from the source collection and write to the destination collection
- Framer Plugin runtime (this runs inside Framer; no external services required)

---

## 🧩 How to use

1. **Open the plugin** in Framer.
2. Choose **Source** and **Destination** collections.
3. Click **Load fields**.
4. In **Field Mapper**:
   - **Slug**: choose **Use existing / auto-generate** _or_ pick a source field to derive from.
   - For each destination field, choose a **source field** on the left (or leave unmapped).
   - If types don’t match, you’ll see a **badge** like `string → image` and a soft highlight.
5. (Optional) **Preview**  
   Click **Preview** to run a **dry-run**: it scans the source, validates mappings, and shows a **modal** with the slugs that would be created (no writes).
6. **Sync**  
   Click **Sync** to batch-add new items. Watch the **progress bar** and then check **stats**.
7. **Rerun later**  
   Your field mapping and slug choice are **remembered per Source→Destination pair**.

---

## 🧠 Field mapping details

- **String / Number / Boolean / Date / Enum**  
  Mapped directly when types match. If not, you’ll see a mismatch badge (sync may still succeed if Framer can coerce).
- **Images / Files**  
  Accepts **URL**, **`src`**, **`id`**, or a nested **value object**. `alt` text is supported (kept if provided).
- **References**  
  For `CollectionReference` and `MultiCollectionReference`, the plugin builds a **slug→id** map for the destination’s referenced collections and translates source values accordingly.
- **Slug generation**  
  - **Use existing / auto-generate**: use the source slug if present; otherwise a stable fallback is created.
  - **Derive from a field**: pick any source field; values are normalized to url-safe slugs.

> **Append-only rule:** if the computed slug **already exists** in the destination, the item is **skipped**.

---

## 🧪 Dry-run (Preview)

- Click **Preview** to simulate the sync **without writing**.
- Shows: `Scanned`, `Skipped`, `To add`, and a scrollable list of the **slugs to be added**.
- If a mapping would fail (e.g., unresolved reference), the preview will surface the problem before you sync.

---

## ⏳ Progress feedback

- Sync runs in batches (default: **50** items).
- While syncing, a **slim progress bar** appears with **batch X/Y** and cumulative **items n/N**.

---

## ⚖️ Conflict policy

- UI includes **“Skip if slug exists”** (active) and **“Update existing (coming soon)”** (disabled).
- The selected policy is **saved with your mapping** for the Source→Destination pair.
- **Current behavior** is always **Skip**; **Update** will be added in a future version.

---

## 💾 Persistence

- The plugin stores per-pair preferences in `localStorage`:
  - Field mapping
  - Slug source choice
  - Conflict policy (for the upcoming update behavior)
- Switching to a different Source→Destination pair restores what you used last time.

---

## 📊 Stats & feedback

- After sync: `Scanned`, `Skipped`, `Added`, `Errors`.
- Inline **notifications** indicate success/warnings/errors.
- The mapper preflight strip lists any **unmapped destination fields** (informational).

---

## 🔐 Permissions

- The plugin **requests** `cms:write` only if/when you actually sync.
- Browsing collections, loading fields, and previewing do not require write permission.

---

## 🛠️ Development

### Project structure

```
cms-sync/
├─ public/
│  └─ icon.png
├─ src/
│  ├─ assets/
│  ├─ App.tsx
│  ├─ App.css
│  ├─ main.tsx
│  ├─ sync.ts
│  ├─ PreviewTable.tsx
│  ├─ PreviewTable.css
│  ├─ csv.ts
│  └─ vite-env.d.ts
├─ framer.json
├─ index.html
├─ package.json
└─ tsconfig.json
```

### Scripts

```bash
yarn check --filter=cms-sync
```

---

## 🚧 Known limitations

- Append-only sync (no updates)
- No retry/error export yet
- Preset management (save/load) not implemented

---

## 🗺️ Roadmap

1. Update existing (conflict policy)
2. Retry & error export (download errors.csv)
3. Saved mapping presets
4. Filter source items
5. Slug safeguards
6. Alt-text defaulting
7. QA shortcut (deep-link destination)
8. Batch size control

---

## 📄 License

MIT — see [LICENSE](LICENSE)
