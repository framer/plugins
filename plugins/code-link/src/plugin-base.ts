import { normalizeCodeFilePathWithExtension } from "@code-link/shared"

/**
 * Plugin-side peer state: one map of normalized path → latest known content (snapshot + echo suppression).
 */
export class PluginBase {
    private readonly byPath = new Map<string, string>()

    remember(fileName: string, content: string): void {
        const key = normalizeCodeFilePathWithExtension(fileName)
        this.byPath.set(key, content)
    }

    /** True when inbound content matches what we last recorded for this path (echo / no-op). */
    shouldSkip(fileName: string, content: string): boolean {
        const key = normalizeCodeFilePathWithExtension(fileName)
        const previous = this.byPath.get(key)
        return previous !== undefined && previous === content
    }

    forget(fileName: string): void {
        this.byPath.delete(normalizeCodeFilePathWithExtension(fileName))
    }

    clear(): void {
        this.byPath.clear()
    }

    getSnapshotContent(fileName: string): string | undefined {
        return this.byPath.get(normalizeCodeFilePathWithExtension(fileName))
    }

    setSnapshotContent(fileName: string, content: string): void {
        this.byPath.set(normalizeCodeFilePathWithExtension(fileName), content)
    }

    deleteSnapshotEntry(fileName: string): void {
        this.byPath.delete(normalizeCodeFilePathWithExtension(fileName))
    }

    /** Paths currently tracked in the snapshot (normalized keys). */
    getSnapshotPaths(): string[] {
        return [...this.byPath.keys()]
    }

    protected async withExpectedSnapshotPatch<T>(
        patch: {
            upserts?: { fileName: string; content: string }[]
            deletes?: string[]
        },
        run: () => Promise<T>
    ): Promise<T> {
        const previousEntries = new Map<string, string | undefined>()

        for (const fileName of patch.deletes ?? []) {
            const key = normalizeCodeFilePathWithExtension(fileName)
            if (!previousEntries.has(key)) {
                previousEntries.set(key, this.byPath.get(key))
            }
            this.byPath.delete(key)
        }

        for (const entry of patch.upserts ?? []) {
            const key = normalizeCodeFilePathWithExtension(entry.fileName)
            if (!previousEntries.has(key)) {
                previousEntries.set(key, this.byPath.get(key))
            }
            this.byPath.set(key, entry.content)
        }

        try {
            return await run()
        } catch (error) {
            for (const [fileName, previousContent] of previousEntries) {
                if (previousContent === undefined) {
                    this.byPath.delete(fileName)
                } else {
                    this.byPath.set(fileName, previousContent)
                }
            }
            throw error
        }
    }
}
