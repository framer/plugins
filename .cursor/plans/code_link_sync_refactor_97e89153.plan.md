---
name: Code Link Sync Refactor
overview: "Refactor Code Link's CLI and plugin around four changes that together make the state model traceable and testable for humans and AI: concentrate mutable state in a SyncRuntime, formalize echo/conflict detection as a SyncBase data model, make effects pure via EffectResult, and route all timers through a named Scheduler. Follow-up: wire protocol uses coarse SyncPhase (initial_sync | ready) via sync-phase messages; internal CLI state uses internalPhase (never sent raw). Plugin socket controller stays untouched."
todos:
  - id: step-1
    content: "Add 3 cross-component integration tests driving start(): watcher-during-snapshot-processing, reconnect-during-conflict-resolution, handshake-replaces-active-socket. Use real fs (tempdir) + fake Watcher + in-memory WebSocket. Existing 3082 lines of tests stay untouched."
    status: completed
  - id: step-2
    content: Introduce Scheduler and timings.ts; replace every CLI setTimeout with named scheduler calls. Plugin timing untouched.
    status: completed
  - id: step-3
    content: Introduce SyncRuntime wrapping existing hashTracker, fileMetadataCache, pendingRenameConfirmations, userActions; effects receive runtime.
    status: completed
  - id: step-4
    content: Introduce SyncBase; collapse hashTracker and watcher echo buffers into base lookups; delete utils/hash-tracker.ts.
    status: completed
  - id: step-5
    content: "Plugin side: introduce PluginBase, collapse api.ts lastSnapshot and sync-tracker.ts into it; delete sync-tracker.ts. Port withExpectedSnapshotPatch rollback. Socket controller untouched."
    status: completed
  - id: step-6
    content: "EffectResult + fixed applyEffectResult pipeline; describeSendLocalChange; executeEffect uses SyncRuntime only (no dual context). rename/once tests rewritten (no vi.mock/module mocks; connection.sendMessage may use spy). Stretch: not every executeEffect branch is pure describe→apply yet."
    status: completed
  - id: step-7
    content: "Superseded by sync-phase work: plugin pluginMode + syncPhase (SyncPhase from CLI); framer UI driven by useLayoutEffect from pluginMode. Removed sync-mode/CliSyncMode; ready only from SYNC_COMPLETE effect boundary."
    status: completed
  - id: step-8
    content: "Plugin: discriminated UiState (state.ui.kind); reducer without pluginMode precedence chains; Mode removed from shared."
    status: completed
  - id: step-9
    content: "PromptSession (connectionId + promptId) on file-delete/conflicts-detected and delete-*/conflicts-resolved; CLI ignores stale sessions; integration test for stale delete-confirmed."
    status: completed
isProject: false
---

# Code Link Sync Refactor

The refactor is four concrete changes plus several follow-on cleanup steps, each independently mergeable behind the existing test suite. No UX change, no CLI flag change. Protocol changes are allowed if they're worth it: they must materially simplify the state model, remove duplicated state/logic, or make transitions more explicit. The plugin's `SocketConnectionController` stays untouched.

## Implementation status (updated)

**Done:** Steps **1–9** (all checklist items closed).

- **1–5, 7:** Unchanged from earlier: integration tests, `Scheduler`/`timings`, `SyncRuntime`, `SyncBase` / `PeerBaseView`, plugin `PluginBase`, sync-phase / `internalPhase`, `sync-tracker` removed.
- **6:** `EffectResult` + `applyEffectResult` (ordered pipeline), `describeSendLocalChange` with declarative `recordLocalSend`, `executeEffect` context is runtime-only. `controller.rename.test.ts` / `controller.once.test.ts` no longer use `vi.mock` / `as never`; optional `vi.spyOn(connection.sendMessage)` for WS boundary. **Remaining stretch (optional):** migrate every `executeEffect` `switch` arm to a pure `describeEffect` + single apply path.
- **8:** Plugin **`UiState`** (`state.ui.kind`: loading, info, syncing, idle, deletePrompt, conflictPrompt, replaced, error); **`Mode`** removed from `@code-link/shared`.
- **9:** **`PromptSession`** on CLI↔plugin prompt messages; **`resolvePendingAction`** + session-scoped action ids; conflict `conflicts-resolved` resolves pending promises (was a latent gap).

**Also landed (was “deferred” in an older draft):** serial **`EventQueue`** for top-level `processEvent` ingress; disconnect UI state folded into **`runtime.disconnectUi`** (not `logging.ts` module globals).

**Still true:** `plugins/code-link/src/utils/sockets.ts` untouched; user-visible sync/delete/conflict/reconnect behavior preserved.

## The thesis in one line

Every mutation goes through a named runtime method. Every echo/conflict question becomes a lookup against one data model. Every effect is a pure function describing what should change. Every timer has a name.

## Protocol changes

Wire changes are allowed when they earn their keep. "Worth it" means the protocol change removes duplicated state, makes sync phase ownership explicit, or simplifies reasoning enough to pay for the extra churn. If a step changes the protocol, update both CLI and plugin in the same branch, document why in the PR, and add or update tests for the changed flow. Mixed old/new branch compatibility is nice-to-have, not required for this refactor.

## Why this layout is AI-traceable

A reviewer or AI asking "is change X safe?" walks exactly three paths:

1. The `transition()` case arm for the event — pure, local, already correct.
2. The `EffectResult` returned by each effect — pure input to output, visible in one function.
3. The `SyncBase` invariant: "base holds what the other side thinks we have; any event matching base is an echo."

No shared closure state. No cross-effect mutation. No timers hidden in the hot path.

## Architecture after the refactor

```mermaid
flowchart TD
    subgraph ingress [Serial queue + apply]
        queue[Event Queue]
        applyResult[Apply EffectResult]
    end
    subgraph pure [Pure]
        transition[transition]
        effects[executeEffect pure, returns EffectResult]
    end
    subgraph syncRuntime [SyncRuntime owns all state]
        base[SyncBase - the data model]
        scheduler[Scheduler - named timers]
        prompts[Prompt coordinator]
        pendingRenames[Pending renames]
    end
    queue --> transition
    transition --> effects
    effects -->|"reads (readonly)"| base
    effects --> applyResult
    applyResult -->|"mutates"| base
    applyResult -->|"schedules"| scheduler
    applyResult -->|"enqueues follow-ups"| queue
```



## Existing test coverage

The repo has 3,082 lines of tests. Most lock in behavior we must preserve. **`controller.rename.test.ts` / `controller.once.test.ts` were rewritten** (Step 6): no `vi.mock` / `as never`; connection may be spied for sends.

**Keep as-is (~2,537 lines) — these test real behavior at real boundaries:**

- `[controller.test.ts](packages/code-link-cli/src/controller.test.ts)` (626 lines) — `transition()` across all modes, already pure
- `[helpers/watcher.test.ts](packages/code-link-cli/src/helpers/watcher.test.ts)` (668 lines) — chokidar rename coalescing, sanitization echo, buffer edge cases
- `[helpers/connection.test.ts](packages/code-link-cli/src/helpers/connection.test.ts)` (175 lines)
- `[helpers/files.test.ts](packages/code-link-cli/src/helpers/files.test.ts)` (398 lines) — `filterEchoedFiles`, `detectConflicts`, drift window
- `[plugins/code-link/src/api.test.ts](plugins/code-link/src/api.test.ts)` (536 lines) — `withExpectedSnapshotPatch` rollback; mocks are at the Framer SDK boundary, legitimate
- `[plugins/code-link/src/utils/sockets.test.ts](plugins/code-link/src/utils/sockets.test.ts)` (134 lines) — mocks `WebSocket` which is an external boundary, legitimate

**Step 6 rewrite (done):** those files now use **`SyncRuntime` + real temp dirs** where needed and **`vi.spyOn(connection.sendMessage)`** only for the WS boundary — not internal context mocks.

The refactor preserves all 2,537 legitimate lines in the “keep as-is” list. Step 1 adds cross-component `start()` coverage in `controller.integration.test.ts`.

## The four changes

### 1. `SyncRuntime` — concentrates the 11 mutable stores

New file `[packages/code-link-cli/src/runtime.ts](packages/code-link-cli/src/runtime.ts)`. Owns every piece of mutable sync state. Exposes narrow named methods instead of raw maps.

Replaces direct access to:

- `[utils/hash-tracker.ts](packages/code-link-cli/src/utils/hash-tracker.ts)`
- `[utils/file-metadata-cache.ts](packages/code-link-cli/src/utils/file-metadata-cache.ts)`
- `pendingRenameConfirmations` Map (currently local to `start()` in `[controller.ts:1110](packages/code-link-cli/src/controller.ts)`)
- `[helpers/plugin-prompts.ts](packages/code-link-cli/src/helpers/plugin-prompts.ts)` `PluginUserPromptCoordinator`
- Installer reference, shutdown flag
- Module-level state in `[utils/logging.ts](packages/code-link-cli/src/utils/logging.ts)` (`disconnectTimer`, `hadRecentDisconnect`, `isShowingDisconnect`)

Illustrative shape (exact method set determined during implementation):

```ts
interface SyncRuntime {
  base: SyncBase
  scheduler: Scheduler
  recordLocalSend(path: string, hash: string): void
  recordRemoteApplied(path: string, hash: string, modifiedAt: number): void
  recordDelete(path: string): void
  registerPendingRename(oldPath: string, newPath: string, content: string): void
  resolvePendingRename(newPath: string): PendingRename | undefined
  awaitUserPrompt(id: string): Promise<PromptResult>
  completeUserPrompt(id: string, result: PromptResult): void
  flush(): Promise<void>
}
```

### 2. `SyncBase` — the formal data model for echo and conflict

The conceptual third tree, implemented as one owned structure inside `SyncRuntime` (via `SyncBase` + metadata). Not a new persisted file — it subsumes `[fileMetadataCache](packages/code-link-cli/src/utils/file-metadata-cache.ts)` which already holds most of this shape.

```ts
interface SyncBaseEntry {
  hash: string          // content hash we and the peer last agreed on
  modifiedAt: number    // when that agreement happened
  tombstone?: boolean   // the peer thinks this file is deleted
}

interface SyncBase {
  get(path: string): SyncBaseEntry | undefined
  isEcho(path: string, hash: string): boolean
  isDeleteEcho(path: string): boolean
  record(path: string, entry: SyncBaseEntry): void
  forget(path: string): void
  snapshot(): Map<string, SyncBaseEntry>
}
```

Every echo check in the codebase becomes a `SyncBase` / `PeerBaseView` lookup (e.g. `isEcho(path, hash)`). The three current systems collapse:

- `[utils/hash-tracker.ts](packages/code-link-cli/src/utils/hash-tracker.ts)` — deleted. Its `shouldSkip`, `shouldSkipDelete`, `markDelete`, `clearDelete`, `forget`, `remember` all become `SyncBase` operations.
- `contentHashCache` / `pendingDeletes` / `pendingAdds` / `recentSanitizations` in `[helpers/watcher.ts](packages/code-link-cli/src/helpers/watcher.ts)` — the buffers that exist for rename coalescing stay (they're data-structure, not echo). Echo suppression (`recentSanitizations`) becomes a base lookup.
- The 5s delete echo window becomes an explicit `tombstone: true` entry with a base-owned TTL, documented in one place.

Plugin side gets a parallel `PluginBase` in the same “single mutable owner” shape, replacing `[api.ts](plugins/code-link/src/api.ts)` `lastSnapshot` and `[packages/code-link-shared/src/sync-tracker.ts](packages/code-link-shared/src/sync-tracker.ts)`. Deleted: `sync-tracker.ts`.

Conflict detection (currently in `[helpers/files.ts](packages/code-link-cli/src/helpers/files.ts)` `detectConflicts`) reads from `base.snapshot()`. Same code, clearer source.

### 3. `EffectResult` — effects become pure

Effects stop receiving mutable context and calling methods imperatively. They receive read-only state and return a description of what should happen.

In `[controller.ts](packages/code-link-cli/src/controller.ts)`, replace:

```ts
async function executeEffect(effect: Effect, context: {
  config, hashTracker, installer, fileMetadataCache,
  pendingRenameConfirmations, shutdown, userActions, syncState
}): Promise<SyncEvent[]>
```

With:

```ts
type RuntimeOp =
  | { op: "recordLocalSend"; path: string; hash: string }
  | { op: "recordRemoteApplied"; path: string; hash: string; modifiedAt: number }
  | { op: "recordDelete"; path: string }
  | { op: "registerPendingRename"; oldPath: string; newPath: string; content: string }
  | { op: "completePendingRename"; newPath: string }
  | { op: "schedule"; name: ScheduledTask; delayMs: number }
  | { op: "cancel"; name: ScheduledTask }

interface EffectResult {
  followUps?: SyncEvent[]
  runtimeOps?: RuntimeOp[]
  sends?: CliToPluginMessage[]
  writes?: FileWrite[]
  deletes?: string[]
  log?: { level: LogLevel; message: string }
}

async function executeEffect(
  effect: Effect,
  readOnly: { runtime: ReadonlyRuntime; config: Config; syncState: SyncState }
): Promise<EffectResult>
```

The controller loop (`processEvent` in `[controller.ts](packages/code-link-cli/src/controller.ts)`) drains effects: describe → apply `runtimeOps` / writes / deletes / sends → enqueue `followUps`. Between effects `SyncRuntime` is always in a consistent state.

Conversion strategy: **compatibility shim**. Runtime accepts both old-style (mutates context, returns `SyncEvent[]`) and new-style (read-only, returns `EffectResult`) effects during the migration. Land one effect at a time. Shim deleted at end of Step 6. This keeps each PR small and bisectable.

**Test rewrite (part of Step 6):** as each effect converts, its tests in `[controller.rename.test.ts](packages/code-link-cli/src/controller.rename.test.ts)` and `[controller.once.test.ts](packages/code-link-cli/src/controller.once.test.ts)` get rewritten from mock-and-assert to value-equality:

```ts
// Before (current style): 30+ lines, 7 vi.fn stubs, 3 `as never` casts
const hashTracker = { remember: vi.fn(), shouldSkip: vi.fn(), ... }
await executeEffect(effect, { hashTracker: hashTracker as never, ... })
expect(hashTracker.remember).toHaveBeenCalledWith("Foo.tsx", content)

// After: 5 lines, zero mocks, zero casts
const result = await describeEffect(effect, { runtime: readOnly, config, syncState })
expect(result.runtimeOps).toContainEqual({ op: "recordLocalSend", path: "Foo.tsx", hash: hashOf(content) })
expect(result.sends).toContainEqual({ type: "file-changed", fileName: "Foo.tsx", content })
```

Goal: both files contain zero `vi.mock`, zero `vi.fn`, zero `as never` by the end of Step 6. Every effect gets a test that reads as a spec. No context mocking — that anti-pattern only existed because `executeEffect` received a mutable context.

### 4. `Scheduler` — every timer has a name

New `Scheduler` owned by `SyncRuntime` (disconnect notice timing, etc.). Replaces every `setTimeout` in the CLI with a named scheduled task. Current behaviors unchanged; durations centralized in a new `[packages/code-link-cli/src/timings.ts](packages/code-link-cli/src/timings.ts)` file with documented rationale.

```ts
type ScheduledTask =
  | "disconnectNotice"
  | "hiddenTabGrace"
  | "reconnectBackoff"
  | "wakeDebounce"
  | "connectTimeout"
  | "renameBuffer"
  | "sanitizationEchoExpiry"
  | "tombstoneExpiry"

interface Scheduler {
  after(name: ScheduledTask, delayMs: number, fn: () => void): void
  cancel(name: ScheduledTask): void
  cancelAll(): void
}

// timings.ts
export const TIMINGS = {
  disconnectNotice: 4_000,     // delay before showing "disconnected" in CLI status
  hiddenTabGrace: 5_000,       // plugin pauses reconnect after tab hidden this long
  reconnectBackoffBase: 500,   // plugin reconnect base delay
  reconnectBackoffMax: 5_000,  // plugin reconnect cap
  wakeDebounce: 300,           // plugin debounces focus/visibility wake
  connectTimeout: 1_500,       // plugin socket connect timeout
  renameBuffer: 100,           // watcher rename coalesce window
  sanitizationEchoExpiry: 300, // watcher suppress echo from path sanitization
  tombstoneExpiry: 5_000,      // SyncBase delete tombstone TTL (former hashTracker delete window)
} as const
```

A test-time `FakeScheduler` makes every timing-dependent behavior deterministic. Only touches CLI; plugin's existing socket timing (already solid) stays as-is.

## Sequencing — nine independently mergeable steps


| Step | Change                                                                                                                                                                                                                                                                                                                 | Behavior change?                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Add targeted end-to-end tests that drive `start()` across component seams. See scope below.                                                                                                                                                                                                                            | No — tests only                                             |
| 2    | Introduce `Scheduler` + `[timings.ts](packages/code-link-cli/src/timings.ts)`. Replace every CLI `setTimeout` with named scheduler calls. Durations unchanged.                                                                                                                                                         | No                                                          |
| 3    | Introduce `SyncRuntime`. Initially wraps existing `hashTracker`, `fileMetadataCache`, `pendingRenameConfirmations`, `userActions`. Effects receive `SyncRuntime` instead of raw maps.                                                                                                                                          | No                                                          |
| 4    | Introduce `SyncBase`. Collapse `hashTracker` and watcher echo buffers into `SyncBase` lookups. Delete `[utils/hash-tracker.ts](packages/code-link-cli/src/utils/hash-tracker.ts)`.                                                                                                                                     | No (tombstone replaces 5s window with equivalent semantics) |
| 5    | Plugin side: introduce `PluginBase`, collapse `[api.ts](plugins/code-link/src/api.ts)` `lastSnapshot` + `[sync-tracker.ts](packages/code-link-shared/src/sync-tracker.ts)` into it. Delete `sync-tracker.ts`. Port `withExpectedSnapshotPatch` rollback semantics into `PluginBase`.                                   | No user-visible change                                      |
| 6    | **Done:** `EffectResult` pipeline + `describeSendLocalChange`; runtime-only `executeEffect`; rename/once tests without module mocks. (Stretch: pure describe for every effect branch.)                                                                                                                                   | No                                                          |
| 7    | **Done (revised):** Was sync-phase / `pluginMode`; superseded in UI by **Step 8** `UiState` while CLI still uses **`syncPhase`** + **`internalPhase`**.                                                                                                                                                               | Protocol break vs old `sync-mode`; beta OK                  |
| 8    | **Done:** Discriminated **`UiState`** in `app-state.ts`; **`App.tsx`** switches on **`state.ui.kind`**.                                                                                                                                                                                                              | No user-visible change                                      |
| 9    | **Done:** **`PromptSession`** on prompt-related messages; stale responses ignored by connection id.                                                                                                                                                                                                                    | No user-visible change; protocol change                     |


Each step passes the existing test suite plus Step 1 integration tests. **Serial event queue** for `start()` ingress is implemented. Optional follow-on: pure watcher rename helper extraction.

## Junior-friendly follow-ons

Steps **8–9 are done** (discriminated UI state + session ids). Optional further polish: **`CodeFilesAPI` composition over inheritance** for `PluginBase`, and **full pure `describeEffect` per effect** (Step 6 stretch).

## Step 1 — narrow scope

The existing tests already cover everything component-local (rename buffering, echo filtering, conflict heuristics, plugin snapshot rollback, socket controller lifecycle). The **only** gap is **cross-component flow through `start()`**. Add one new file, `packages/code-link-cli/src/controller.integration.test.ts`, with these specific scenarios:

1. **Watcher fires during `snapshot_processing`** — handshake + `REMOTE_FILE_LIST` in flight when a local watcher event arrives. Verify it's queued into `pendingRemoteChanges` and applied after snapshot commits.
2. **Reconnect during `conflict_resolution`** — socket drops while user has pending conflict prompt; new handshake arrives. Verify prompt coordinator isn't left dangling and the new snapshot is re-reconciled correctly.
3. **Handshake replaces active socket** — second plugin client connects with same `projectId`. Verify old socket gets `CLOSE_CODE_REPLACED` and new one proceeds through full handshake.

Test scaffolding (keep minimal):

- **Socket fake**: tiny in-memory object implementing `send`, `close`, `readyState` — the only `ws.WebSocket` surface `helpers/connection.ts::sendMessage` uses. **Do not** rebuild the plugin's `SocketConnectionController`; it stays out of scope.
- **FS**: real `fs` in `os.tmpdir()` subdirs (pattern already used by `[controller.rename.test.ts](packages/code-link-cli/src/controller.rename.test.ts)`).
- **Watcher**: inject a fake implementing the `Watcher` interface at `[helpers/watcher.ts:16](packages/code-link-cli/src/helpers/watcher.ts)` so tests emit events deterministically without chokidar debounce timing. The real `initWatcher` stays covered by the existing 668-line `watcher.test.ts`.

That's it. If these three pass before and after each subsequent step, the refactor is safe.

## Explicit out-of-scope: do not modify

These are correct, well-tested, or unrelated. The refactor must not touch them. If a step seems to require changing one, stop and reconsider the approach.

**Plugin side:**

- `[plugins/code-link/src/utils/sockets.ts](plugins/code-link/src/utils/sockets.ts)` (390 lines, covered by `[sockets.test.ts](plugins/code-link/src/utils/sockets.test.ts)`) — `SocketConnectionController`, visibility/focus handling, `CLOSE_CODE_REPLACED`, connect-timeout graduation (1500ms → 3000ms), hidden-tab grace. Its three internal timers (`connectTrigger`, `connectTimeout`, `hiddenGrace`) already have names. **Step 2's `Scheduler` does not extend to the plugin.**
- `[plugins/code-link/src/main.tsx](plugins/code-link/src/main.tsx)`, `[App.css](plugins/code-link/src/App.css)`
- `[plugins/code-link/src/utils/clipboard.ts](plugins/code-link/src/utils/clipboard.ts)`, `[diffing.ts](plugins/code-link/src/utils/diffing.ts)`, `[logger.ts](plugins/code-link/src/utils/logger.ts)`, `[useConstant.ts](plugins/code-link/src/utils/useConstant.ts)`
- `[messages.ts](plugins/code-link/src/messages.ts)` — handles **`sync-phase`** (`phase: SyncPhase`); no longer `sync-mode` / `sync-complete`.

**CLI side — protected logic within in-scope files:**

- `transition()` in `[controller.ts](packages/code-link-cli/src/controller.ts)` — **updated**: `SyncState` uses **`internalPhase`** (was `mode`); `HANDSHAKE` adds **`EMIT_SYNC_PHASE`** (`initial_sync`). `SyncEvent` / core `Effect` variants otherwise same spirit.
- `detectConflicts`, `autoResolveConflicts`, drift windows, sanitization in `[helpers/files.ts](packages/code-link-cli/src/helpers/files.ts)` — unchanged; only the data source shifts from ad-hoc maps to `PeerBaseView` / persisted metadata as appropriate.
- `[helpers/git.ts](packages/code-link-cli/src/helpers/git.ts)`, `[helpers/skills.ts](packages/code-link-cli/src/helpers/skills.ts)`, `[helpers/certs.ts](packages/code-link-cli/src/helpers/certs.ts)`, `[helpers/installer.ts](packages/code-link-cli/src/helpers/installer.ts)` — external I/O boundaries, already correctly mocked. Do not touch.
- `[helpers/sync-validator.ts](packages/code-link-cli/src/helpers/sync-validator.ts)` — pure, stays pure; only its consumer changes.
- `[utils/state-persistence.ts](packages/code-link-cli/src/utils/state-persistence.ts)` — on-disk format unchanged.
- `[utils/imports.ts](packages/code-link-cli/src/utils/imports.ts)`, `[utils/node-paths.ts](packages/code-link-cli/src/utils/node-paths.ts)`, `[utils/project.ts](packages/code-link-cli/src/utils/project.ts)`
- `[types.ts](packages/code-link-cli/src/types.ts)`, `[index.ts](packages/code-link-cli/src/index.ts)` — public API unchanged.

**Shared:**

- `[packages/code-link-shared/src/types.ts](packages/code-link-shared/src/types.ts)` — canonical protocol surface. Message changes are allowed only when they materially reduce duplicated state/logic and are covered by tests.
- `[packages/code-link-shared/src/hash.ts](packages/code-link-shared/src/hash.ts)`, `[paths.ts](packages/code-link-shared/src/paths.ts)` — unchanged.

**Tests — protected (2,537 lines, do not rewrite):**

- `[controller.test.ts](packages/code-link-cli/src/controller.test.ts)`, `[helpers/watcher.test.ts](packages/code-link-cli/src/helpers/watcher.test.ts)`, `[helpers/connection.test.ts](packages/code-link-cli/src/helpers/connection.test.ts)`, `[helpers/files.test.ts](packages/code-link-cli/src/helpers/files.test.ts)`, `[plugins/code-link/src/api.test.ts](plugins/code-link/src/api.test.ts)`, `[plugins/code-link/src/utils/sockets.test.ts](plugins/code-link/src/utils/sockets.test.ts)`, `[helpers/skills.test.ts](packages/code-link-cli/src/helpers/skills.test.ts)`, `[helpers/certs.test.ts](packages/code-link-cli/src/helpers/certs.test.ts)`, `[helpers/installer.test.ts](packages/code-link-cli/src/helpers/installer.test.ts)`, `[utils/project.test.ts](packages/code-link-cli/src/utils/project.test.ts)`, and all `packages/code-link-shared/src/*.test.ts`.
- These must pass unchanged after every step. If one fails, the step is wrong — do not edit the test to make it pass.

## What stays exactly the same

- User-visible sync behavior: same conflict UX, same delete UX, same reconnect UX, same tab replacement UX
- Every conflict detection rule in `[helpers/files.ts](packages/code-link-cli/src/helpers/files.ts)`
- The 2000ms drift window in `autoResolveConflicts`
- The 5s delete echo behavior (now a named tombstone)
- On-disk format of persisted state in `[utils/state-persistence.ts](packages/code-link-cli/src/utils/state-persistence.ts)`
- Every CLI flag
- `transition()` shape (event → state + effects); internal field is now **`internalPhase`**
- Public API: `start(config)` from `[controller.ts](packages/code-link-cli/src/controller.ts)`
- All UX: conflict modal, delete confirmation, reconnect behavior, tab replacement
- **The plugin's `[SocketConnectionController](plugins/code-link/src/utils/sockets.ts)`** — visibility/focus handling, `CLOSE_CODE_REPLACED`, connect-timeout graduation, hidden-tab grace. Zero changes; it's correct and hard-won.
- Core behavioral tests preserved; some lines updated for **`internalPhase`**, **`sync-phase`**, and **`pluginMode` / `syncPhase`**.

## Risks and mitigations

- `**SyncBase` tombstone changes echo timing** — Step 1 test 1 plus the existing rapid-delete tests in `files.test.ts` cover this. Tombstone TTL matches current 5s `hashTracker` window. Centralized and documented.
- `**Protocol changes create mixed-version risk`** — acceptable when the simplification is worth it. Land CLI + plugin protocol updates together in the same branch/PR, document the rationale, and add/update tests for the new message flow. Backward compatibility with mixed old/new commits is optional, not required here.
- `**Plugin reconnect/prompt state is still hard to read**` — Step 8 removes implicit precedence rules by making UI state a discriminated union. If reconnect safety still depends on "knowing the flow," Step 9 adds prompt/session identity and turns it into an equality check.
- `**EffectResult` conversion is a large diff** — land one effect at a time behind a compatibility shim that accepts both old-style (mutates runtime) and new-style (returns result). Remove shim at the end.
- `**PluginBase` drops `withExpectedSnapshotPatch` transactional rollback** — port rollback semantics into `PluginBase.apply`; `[api.test.ts](plugins/code-link/src/api.test.ts)` (536 lines) covers this.
- **Logging module state migration** — `[utils/logging.ts](packages/code-link-cli/src/utils/logging.ts)` `disconnectTimer` / `hadRecentDisconnect` / `isShowingDisconnect` fold into `SyncRuntime.disconnectUi` during Step 2 via the scheduler, or during Step 3 if easier. Small, isolated.

## Review ergonomics after landing

A reviewer or AI answering "is X safe?" reads three files in order:

1. The `transition()` case arm in `[controller.ts](packages/code-link-cli/src/controller.ts)` — pure, local.
2. The `executeEffect` case — pure function, inputs visible, `EffectResult` visible.
3. The `SyncBase` or `Scheduler` method the effect's `runtimeOps` reference — named, under 20 lines.

No closure state to trace. No cross-effect mutation to consider. No timers to reason about without a name. The answer is local.

## Test ergonomics after landing

Mocks exist only at real external boundaries: Framer SDK (`[api.test.ts](plugins/code-link/src/api.test.ts)`), `WebSocket` (`[sockets.test.ts](plugins/code-link/src/utils/sockets.test.ts)`), `fs`/`crypto` where unavoidable (`[certs.test.ts](packages/code-link-cli/src/helpers/certs.test.ts)`, `[installer.test.ts](packages/code-link-cli/src/helpers/installer.test.ts)`). Internal tests for effects are pure value-equality:

- Adding a new effect means adding one case to `executeEffect`, one test that passes an `Effect` and asserts on `EffectResult`. No mock setup. No `as never`.
- When a reviewer asks "does this effect do the right thing?", the test reads like a spec: given this effect, produce exactly this `EffectResult`.
- `controller.rename.test.ts` / `controller.once.test.ts`: no `vi.mock` (Step 6). `controller.test.ts` remains pure `transition()` tests.

