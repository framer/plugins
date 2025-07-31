import {
    type ManagedCollection,
    type ManagedCollectionFieldInput,
    type ManagedCollectionItemInput,
} from "framer-plugin"
import { simpleHash, slugify } from "./utils"

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
    [dateFieldId]: Date | null
    [contentFieldId]: string
}

const rssSources = [
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
] as const satisfies RSSSource[]

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

        items.push({ title, link, date: date ? new Date(date) : null, content: description })
    }

    return items
}

// Creates fields in the CMS collection for every key in the "RSSEntry" type.
function getCollectionFields(): ManagedCollectionFieldInput[] {
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

    const itemsToAdd: ManagedCollectionItemInput[] = []
    for (const item of items) {
        // RSS items don't have an ID - we hash the title.
        const id = simpleHash(item.title)

        unseenItemIds.delete(id)

        itemsToAdd.push({
            id,
            slug: slugify(item.title),
            slugByLocale: {},
            fieldData: {
                [titleFieldId]: {
                    type: "string",
                    value: item.title,
                },
                [linkFieldId]: {
                    type: "link",
                    value: item.link,
                },
                [dateFieldId]: {
                    type: "date",
                    value: item.date?.toISOString() ?? null,
                },
                [contentFieldId]: {
                    type: "formattedText",
                    value: item.content,
                },
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

export { rssSources }
