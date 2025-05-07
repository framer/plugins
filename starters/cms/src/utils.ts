function slugify(text: string) {
    return text
        .replace(/^\s+|\s+$/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
}

export function createUniqueSlug(text: string, existingSlugs: Map<string, number>) {
    text = text.trim().slice(0, 60)

    if (existingSlugs.has(text)) {
        const count = existingSlugs.get(text) ?? 0
        existingSlugs.set(text, count + 1)
        text = `${text} ${count + 1}`
    } else {
        existingSlugs.set(text, 0)
    }

    return slugify(text)
}

// Find an item in an array using an async callback: https://stackoverflow.com/questions/55601062/using-an-async-function-in-array-find
export async function findAsync<T>(arr: T[], asyncCallback: (item: T) => Promise<boolean>) {
    const promises = arr.map(asyncCallback)
    const results = await Promise.all(promises)
    const index = results.findIndex(result => result)
    return arr[index]
}
