import { framer, ManagedCollection } from "framer-plugin"

import { useState } from "react"
import "./App.css"
import { simpleHash, slugify } from "./utils"

const contentFieldId = "content"

const html = `
<html>
<p>example md file</p>
<pre><code>import { z } from &#39;zod&#39;

</code></pre>

</html>
`
export async function importData(collection: ManagedCollection) {
    try {
        await collection.setFields([
            {
                type: "formattedText",
                name: "Content",
                id: contentFieldId,
            },
        ])

        const unseenItemIds = new Set(await collection.getItemIds())

        // Remove all the items that weren't in the new feed
        const itemsToDelete = Array.from(unseenItemIds)
        await collection.removeItems(itemsToDelete)
        await collection.addItems([
            {
                id: simpleHash("x"),
                slug: slugify("x"),

                fieldData: {
                    [contentFieldId]: html,
                },
            },
        ])
        await framer.notify("Import successful!")
    } catch (error: any) {
        console.error("Error importing data:", error)
        await framer.notify(error.message, { variant: "error" })
        return { error }
    }
}

interface Props {
    collection: ManagedCollection
}

interface Props {
    collection: ManagedCollection
}

export function App({ collection }: Props) {
    const [isSyncing, setIsSyncing] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)

    const handleImport = async () => {
        setIsSyncing(true)
        setImportError(null)
        try {
            const result = await importData(collection)
            if (result && result.error) {
                setImportError(result.error.message)
            }
        } finally {
            setIsSyncing(false)
        }
    }
    if (importError) {
        return <div style={{ color: "red", fontFamily: "monospace", padding: "20px" }}>{importError}</div>
    }

    return (
        <main>
            <p>Issue repro.</p>

            <button disabled={isSyncing} className="framer-button-primary" onClick={handleImport}>
                Import
            </button>
        </main>
    )
}
