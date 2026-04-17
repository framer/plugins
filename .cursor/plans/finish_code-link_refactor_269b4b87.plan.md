---
name: finish code-link refactor
overview: Finish steps 6, 8, 9. Every effect becomes describe()->EffectResult->apply() with one fixed pipeline; plugin UI becomes a discriminated union; delete/conflict prompts carry session ids. One branch, no shim, no effect-test mocks.
todos:
  - id: narrow-runtime
    content: Narrow SyncRuntime API + introduce PeerBaseView; migrate helpers/files.ts off HashTracker; delete HashTracker export
    status: completed
  - id: describe-apply
    content: Convert every effect to describe()->EffectResult; rewrite applyEffectResult with fixed 8-step pipeline; delete old ExecuteEffectContext union
    status: completed
  - id: rewrite-tests
    content: Rewrite controller.rename.test.ts + controller.once.test.ts as EffectResult value-equality; zero mocks
    status: completed
  - id: event-queue
    content: Add serial EventQueue wrapping processEvent (exactly one event at a time)
    status: completed
  - id: plugin-union
    content: Replace plugin app-state with discriminated UiState union; rewire App.tsx; update tests; delete Mode from shared
    status: completed
  - id: session-ids
    content: Add Session (connectionId + promptId) to delete/conflict messages both sides; CLI ignores stale; extend tests
    status: completed
  - id: logging-state
    content: Fold logging.ts module state into runtime.disconnectUi
    status: completed
  - id: typecheck-green
    content: Run tsc + vitest on both packages; confirm zero mocks in effect tests
    status: completed
isProject: false
---

## Thesis

Every branch of control reads the same way:

1. `transition()` case (pure; already correct).
2. `describeX(effect, read)` -> `EffectResult` (pure; new).
3. `applyEffectResult(result, runtime)` (single function; fixed order).

One place holds ordering rules. One place holds state. Zero closures, zero per-effect mocks.

## Pipeline (locks ordering for all effects)

`applyEffectResult(result, ctx)` runs, in order (see `controller.ts` for the current step list):

1. `log` - emit immediately.
2. `writes` - `writeRemoteFiles`: record remote metadata via `applyRuntimeOp` / `recordRemoteApplied` AFTER disk write (see pipeline comment in `controller.ts`).
3. `deletes` - `deleteLocalFile` then `recordDelete` via `applyRuntimeOp`.
4. `sends` - `sendMessage`. For `file-change` post-ack: `recordLocalSend` + `fileUp` via the fixed pipeline; for `file-rename` post-ack `registerPendingRename`, etc.
5. `runtimeOps` - pre/post-send ops: `recordLocalSend`, `registerPendingRename`, `recordRemoteApplied`, `completePendingRename`, `noteEmittedSyncPhase`, etc.
6. `persistState` - `metadata.flush()`.
7. `installerProcess` - only if corresponding `file-change` send succeeded.
8. `followUps` - returned as `SyncEvent[]` to runtime.

Two implicit echo rules live inside apply:
- `writes` -> remember BEFORE disk (matches `writeRemoteFiles`).
- `sends[file-change]` -> remember AFTER ack (matches current post-send).

Only ordering gotchas; everything else flat.

## SyncRuntime narrow API (replaces HashTracker leak)

[packages/code-link-cli/src/runtime.ts](packages/code-link-cli/src/runtime.ts):

```ts
interface SyncRuntime {
  isEcho(path: string, content: string): boolean
  isDeleteEcho(path: string): boolean
  metadataFor(path: string): FileSyncMetadata | undefined
  persistedSnapshot(): Map<string, PersistedFileState>

  recordLocalSend(path: string, content: string): void
  recordRemoteApplied(path: string, content: string, mtime: number): void
  recordDelete(path: string): void
  markDelete(path: string): void
  clearDeleteMark(path: string): void
  forgetEcho(path: string): void

  registerPendingRename(old: string, new_: string, content: string): void
  resolvePendingRename(newPath: string): PendingRename | undefined
  completePendingRename(newPath: string): void
  awaitDeleteDecision(session, fileNames): Promise<string[]>
  awaitConflictDecisions(session, conflicts): Promise<Map<string,"local"|"remote">>
  handleDeleteConfirmation(session, fileName, confirmed): boolean
  handleConflictsResolved(session, resolution): void

  installer: Installer | null
  flush(): Promise<void>
  resetPrompts(): void
}
```

`helpers/files.ts` `writeRemoteFiles` / `deleteLocalFile` / `filterEchoedFiles` stop taking `HashTracker`; they take `PeerBaseView` readonly adapter. Delete `HashTracker` interface + `createHashTracker` shim from [sync-base.ts](packages/code-link-cli/src/sync-base.ts).

## Per-effect describe step

Rewrite big switch in [controller.ts](packages/code-link-cli/src/controller.ts):

```ts
async function executeEffect(effect: Effect, read: ReadCtx): Promise<EffectResult>
```

`ReadCtx = { config, runtime: ReadonlyRuntime, syncState }`. Pure async (may read disk for `DETECT_CONFLICTS`, `UPDATE_FILE_METADATA`, `LIST_LOCAL_FILES`). No runtime mutation inside describe.

- `INIT_WORKSPACE` -> `runtimeOps:[{op:"initWorkspace", projectInfo}]`.
- `LOAD_PERSISTED_STATE` -> `runtimeOps:[{op:"loadPersistedState"}]`.
- `LIST_LOCAL_FILES` -> read `listFiles(filesDir)`; `sends:[{type:"file-list", files}]`.
- `DETECT_CONFLICTS` -> run `detectConflicts`; `runtimeOps: unchanged.map(recordRemoteApplied)`; `followUps:[{type:"CONFLICTS_DETECTED",...}]`.
- `SEND_MESSAGE` -> `sends:[payload]`.
- `EMIT_SYNC_PHASE` -> `sends:[{type:"sync-phase",phase}]` + `runtimeOps:[{op:"noteEmittedSyncPhase",phase}]`.
- `WRITE_FILES` -> `writes:{files: skipEcho ? filterEchoed(files) : files, silent, skipEcho}` (apply records `recordRemoteApplied` per file before disk).
- `DELETE_LOCAL_FILES` -> `deletes: names`.
- `REQUEST_CONFLICT_DECISIONS` / `REQUEST_CONFLICT_VERSIONS` -> `sends:[...]` + `runtimeOps:[{op:"awaitConflictDecisions", session, conflicts}]`.
- `SEND_LOCAL_CHANGE` -> existing `describeSendLocalChange` (already pure); apply handles post-send remember + fileUp + installer.
- `SEND_FILE_RENAME` -> describe checks echo via `read.runtime.isEcho` + `isDeleteEcho`; if echo, `runtimeOps:[{op:"forgetEcho",path:new},{op:"clearDeleteMark",path:old}]`; else `sends:[{type:"file-rename",...}]` + `runtimeOps:[{op:"registerPendingRename",...}]` applied post-ack.
- `LOCAL_INITIATED_FILE_DELETE` -> partitions files via `isDeleteEcho`; `runtimeOps:[{op:"clearDeleteMark",...}]` for echoes; `sends:[{type:"file-delete",requireConfirmation,session}]` + `runtimeOps:[{op:"awaitDeleteDecision", session, files}]`.
- `UPDATE_FILE_METADATA` -> reads current content + pending rename; `runtimeOps` describing (`recordRemoteApplied` + optional `recordDelete(oldRename)` + `recordLocalSend(new)` + `completePendingRename(new)`).
- `PERSIST_STATE` -> `persistState: true`.
- `SYNC_COMPLETE` -> `sends:[{type:"sync-phase",phase:"ready"}]`, `log`, `followUps: config.once ? [{type:"SHUTDOWN"}] : []`, `runtimeOps:[{op:"resetDisconnectState"}]`. New `SHUTDOWN` effect calls `shutdown()` in apply.
- `LOG` -> `log`.

After: delete old `ExecuteEffectContext` union, compatibility branch, `hashTracker.remember` call in `applyEffectResult`'s send loop (moved into `recordLocalSend` op applied post-ack).

## Test rewrite (rename + once)

- [controller.rename.test.ts](packages/code-link-cli/src/controller.rename.test.ts) and [controller.once.test.ts](packages/code-link-cli/src/controller.once.test.ts) stop mocking context.
- Each test: real `SyncRuntime`, call `describeEffect(effect, { config, runtime, syncState })`, assert returned `EffectResult` with `toEqual` / `toContainEqual`.
- Zero `vi.mock`, zero `vi.fn`, zero `as never`.
- Example (rename echo):

```ts
const runtime = new SyncRuntime()
runtime.rememberLocalSend("New.tsx", content)
runtime.markDeleteBeforeUnlink("Old.tsx")

const result = await describeEffect(
  { type: "SEND_FILE_RENAME", oldFileName: "Old.tsx", newFileName: "New.tsx", content },
  { config, runtime, syncState: watchingSyncState }
)

expect(result).toEqual({
  log: { level: "debug", message: expect.stringContaining("Skipping echoed rename") },
  runtimeOps: [
    { op: "forgetEcho", path: "New.tsx" },
    { op: "clearDeleteMark", path: "Old.tsx" },
  ],
})
```

- `controller.test.ts`, `watcher.test.ts`, `files.test.ts`, `connection.test.ts`, integration test, plugin tests untouched (except pure `HashTracker`->`PeerBaseView` rename).

## Step 8 - plugin discriminated-union UI state

Replace [plugins/code-link/src/app-state.ts](plugins/code-link/src/app-state.ts) triple with:

```ts
type UiState =
  | { kind: "booting" }
  | { kind: "no_permissions"; project: ProjectInfo }
  | { kind: "no_project" }
  | { kind: "connecting"; project: ProjectInfo }
  | { kind: "syncing"; project: ProjectInfo; session: Session }
  | { kind: "idle"; project: ProjectInfo; session: Session }
  | { kind: "delete_confirmation"; project: ProjectInfo; session: Session; files: PendingDelete[]; background: "syncing"|"idle" }
  | { kind: "conflict_resolution"; project: ProjectInfo; session: Session; conflicts: ConflictSummary[]; background: "syncing"|"idle" }
  | { kind: "replaced" }
```

Rules in reducer (no precedence chains):

- `pending-deletes` while `idle|syncing` -> `delete_confirmation`, `background = prev.kind`.
- `conflicts` analogous.
- `sync-phase` while prompt is open updates `background` only; does not leave prompt.
- `clear-pending-deletes|clear-conflicts` returns to `background`.
- `socket-disconnected|socket-replaced|permissions-updated(false)` collapse to `no_permissions|connecting|replaced` (prompts gone by construction).

`App.tsx` switches on `state.kind` directly; `backgroundStatusFromMode` keyed off `UiState.kind`. Delete `Mode` from [packages/code-link-shared/src/types.ts](packages/code-link-shared/src/types.ts) and `modeFromSyncPhase`.

Tests: update [app-state.test.ts](plugins/code-link/src/app-state.test.ts) to new kinds; add "sync-phase while prompt open updates background only" and "new conflicts while delete prompt open queue behind it".

## Step 9 - prompt/session ids

Protocol (CLI + plugin one branch):

- `Session = { connectionId: string; promptId: string }` minted by CLI per prompt.
- CLI -> plugin: `file-delete` + `conflicts-detected` gain `session`.
- Plugin -> CLI: `delete-confirmed` + `delete-cancelled` + `conflicts-resolved` echo `session`.

CLI: handshake increments `connectionId`; `SyncRuntime` stores promises keyed by session; incoming responses with mismatched `connectionId` ignored + warn logged.

Plugin: session stored in `delete_confirmation`/`conflict_resolution` kind; `socket-disconnected`/`socket-replaced` discards prompt state (union guarantees).

Shared: update [types.ts](packages/code-link-shared/src/types.ts) + `isCliToPluginMessage` guard.

Tests: extend "ignores stale delete confirmations after reconnect" integration test + new plugin unit test asserting plugin echoes received session.

## Extras for AI-traceability

- Serial `processEvent`: new `EventQueue` in [controller.ts](packages/code-link-cli/src/controller.ts); single in-flight flag + FIFO pending array; invariant: exactly one `processEvent` runs at a time.
- Fold logging module state (`isShowingDisconnect`, `hadRecentDisconnect`) into `runtime.disconnectUi` with named getters/setters; [logging.ts](packages/code-link-cli/src/utils/logging.ts) keeps only printing.
- Delete `HashTracker` export from [sync-base.ts](packages/code-link-cli/src/sync-base.ts); callers use `PeerBaseView`.
- Top-of-file comment on `controller.ts` links the three-step trace: transition -> executeEffect (describe) -> applyEffectResult (fixed pipeline).

## Order of work

1. Narrow `SyncRuntime` API + `PeerBaseView`; migrate `helpers/files.ts`. No behavior change.
2. Convert every effect to `describe()`-returning `EffectResult`. Rewrite `applyEffectResult` to fixed 8-step pipeline. Delete old `ExecuteEffectContext` union + hashTracker-mutating send path.
3. Rewrite `controller.rename.test.ts` + `controller.once.test.ts` to value-equality on `EffectResult`; zero mocks.
4. Add serial `EventQueue`.
5. Plugin discriminated-union `UiState`; rewire `App.tsx`; update `app-state.test.ts`; delete `Mode` from shared.
6. Add `Session` to delete/conflict protocol both sides; update `plugin-prompts.ts`, `messages.ts`, plugin reducer; extend integration tests.
7. Fold logging module state into runtime.
8. `tsc` + `vitest` both packages; all green.

## Success metric

For any change to sync behavior, reader answers safety with exactly three reads:

1. `transition()` case for the event.
2. `describe...` returning `EffectResult`.
3. Corresponding step in `applyEffectResult`'s fixed pipeline (and, if echo-related, the `RuntimeOp` applied there).

No closure state. No cross-effect mutation. No unnamed timers. No hidden "when does this run".