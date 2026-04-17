import { hashContent, normalizeCodeFilePath } from "@code-link/shared"

/**
 * Plugin-side sync state: Framer snapshot mirror + echo hashes (CLI ↔ Framer loop suppression).
 */
export class PluginBase {
    protected lastSnapshot = new Map<string, string>()
    private contentHashes = new Map<string, string>()

    remember(fileName: string, content: string): void {
        this.contentHashes.set(normalizeCodeFilePath(fileName), hashContent(content))
    }

    shouldSkip(fileName: string, content: string): boolean {
        return this.contentHashes.get(normalizeCodeFilePath(fileName)) === hashContent(content)
    }

    forget(fileName: string): void {
        this.contentHashes.delete(normalizeCodeFilePath(fileName))
    }

    clear(): void {
        this.contentHashes.clear()
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
            if (!previousEntries.has(fileName)) {
                previousEntries.set(fileName, this.lastSnapshot.get(fileName))
            }
            this.lastSnapshot.delete(fileName)
        }

        for (const entry of patch.upserts ?? []) {
            if (!previousEntries.has(entry.fileName)) {
                previousEntries.set(entry.fileName, this.lastSnapshot.get(entry.fileName))
            }
            this.lastSnapshot.set(entry.fileName, entry.content)
        }

        try {
            return await run()
        } catch (error) {
            for (const [fileName, previousContent] of previousEntries) {
                if (previousContent === undefined) {
                    this.lastSnapshot.delete(fileName)
                } else {
                    this.lastSnapshot.set(fileName, previousContent)
                }
            }
            throw error
        }
    }
}
