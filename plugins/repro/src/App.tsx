import { Collection, CollectionField, framer, ManagedCollection } from "framer-plugin"

import { useState } from "react"
import "./App.css"
import { RSSIcon } from "./icons"
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
    await collection.setFields([
        {
            type: "formattedText",
            name: "Content",
            id: contentFieldId,
        },
    ])

    const unseenItemIds = new Set(await collection.getItemIds())

    await collection.addItems([
        {
            id: simpleHash("x"),
            slug: slugify("x"),

            fieldData: {
                [contentFieldId]: html,
            },
        },
    ])

    // Remove all the items that weren't in the new feed
    const itemsToDelete = Array.from(unseenItemIds)
    await collection.removeItems(itemsToDelete)
}

interface Props {
    collection: ManagedCollection
}

export function App({ collection }: Props) {
    const [isSyncing, setIsSyncing] = useState(false)

    const handleImport = async () => {
        setIsSyncing(true)

        try {
            await importData(collection)
            await framer.closePlugin()
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <main>
            <div className="illustration">
                <RSSIcon />
            </div>
            <p>Import the most recent blog content from a public RSS feed such as ESPN or Wired.</p>

            <div className="field">
                <label className="label" htmlFor="selectSource">
                    Feed
                </label>
            </div>

            <button disabled={isSyncing} className="framer-button-primary" onClick={handleImport}>
                Import
            </button>
        </main>
    )
}
