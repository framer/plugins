import { CollectionField, CollectionItemData, framer, ManagedCollection } from "framer-plugin"

import "./App.css"
import { useState } from "react"
import { simpleHash, slugify } from "./utils"
import { RSSIcon } from "./icons"

interface RSSSource {
    name: string
    url: string
    id: string
}

// Field IDs used in the CMS
const linkFieldId = "link"
const dateFieldId = "date"
const contentFieldId = "content"
const titleFieldId = "title"

// A key to store the selected RSS source in the plugin data so it can be reused
export const rssSourceStorageKey = "rssSourceId"

interface RSSEntry {
    title: string
    [linkFieldId]: string
    [dateFieldId]: string | undefined
    [contentFieldId]: string
}

const rssSources: RSSSource[] = [
    {
        name: "The New York Times",
        url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        id: "nyt",
    },
    {
        name: "Wired",
        url: "https://www.wired.com/feed/rss",
        id: "wired",
    },
    {
        name: "ESPN",
        url: "https://www.espn.com/espn/rss/news",
        id: "espn",
    },
    {
        name: "Architectural Digest",
        url: "https://www.architecturaldigest.com/feed/rss",
        id: "architecturaldigest",
    },
]

function parseRSS(xmlDoc: Document) {
    const items: RSSEntry[] = []

    let itemNodes = xmlDoc.querySelectorAll("entry")
    if (itemNodes.length === 0) itemNodes = xmlDoc.querySelectorAll("item")

    for (const item of itemNodes) {
        const title = item.querySelector("title")?.textContent?.trim()
        if (!title) continue

        const description = item.querySelector("description")?.textContent?.trim()
        if (!description) continue

        const link = item.querySelector("link")?.textContent?.trim()
        if (!link) continue

        const date = item.querySelector("pubDate")?.textContent?.trim()

        items.push({ title, link, date, content: description })
    }

    return items
}

// Creates fields in the CMS collection for every key in the "RSSEntry" type.
function getCollectionFields(): CollectionField[] {
    return [
        {
            type: "string",
            name: "Title",
            id: titleFieldId,
        },
        {
            type: "link",
            id: linkFieldId,
            name: "Link",
        },
        {
            type: "date",
            name: "Date",
            id: dateFieldId,
        },
        {
            type: "formattedText",
            name: "Content",
            id: contentFieldId,
        },
    ]
}

export async function importData(collection: ManagedCollection, sourceId: string) {
    const rssSource = rssSources.find(source => source.id === sourceId)
    if (!rssSource) throw new Error("Invalid collection source id")

    const response = await fetch(rssSource.url)
    const rssText = await response.text()
    const document = new DOMParser().parseFromString(rssText, "text/xml")

    const items = parseRSS(document)

    const fields = getCollectionFields()
    await collection.setFields(fields)

    const unseenItemIds = new Set(await collection.getItemIds())

    const itemsToAdd: CollectionItemData[] = []
    for (const item of items) {
        // RSS items don't have an ID - we hash the title.
        const id = simpleHash(item.title)

        unseenItemIds.delete(id)

        itemsToAdd.push({
            id,
            slug: slugify(item.title),
            fieldData: {
                [titleFieldId]: item.title,
                [linkFieldId]: item.link,
                [dateFieldId]: item.date,
                [contentFieldId]: item.content,
            },
        })
    }

    await collection.addItems(itemsToAdd)

    // Remove all the items that weren't in the new feed
    const itemsToDelete = Array.from(unseenItemIds)
    await collection.removeItems(itemsToDelete)

    // Save the data source ID for future plugin runs
    await collection.setPluginData(rssSourceStorageKey, sourceId)
}

interface Props {
    collection: ManagedCollection
    initialRssSourceId: string | null
}

export function App({ collection, initialRssSourceId }: Props) {
    const [selectedSourceId, setSelectedSourceId] = useState<string>(initialRssSourceId ?? rssSources[0]!.id)
    const [isSyncing, setIsSyncing] = useState(false)

    const selectedSource = rssSources.find(source => source.id === selectedSourceId)

    const handleImport = async () => {
        if (!selectedSource) return

        setIsSyncing(true)

        try {
            await importData(collection, selectedSourceId)
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
                <select
                    id="selectSource"
                    className="select"
                    value={selectedSourceId}
                    onChange={e => setSelectedSourceId(e.target.value)}
                >
                    {rssSources.map(source => (
                        <option value={source.id} key={source.id}>
                            {source.name}
                        </option>
                    ))}
                </select>
            </div>

            <button disabled={!selectedSource || isSyncing} className="framer-button-primary" onClick={handleImport}>
                Import
            </button>
        </main>
    )
}
