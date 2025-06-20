export async function requestIndexing(url: string, token: string) {
    const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
        body: JSON.stringify({
            url: url,
            type: "URL_UPDATED",
        }),
    })

    if (response.status === 403) {
        console.error(`🔐 This service account doesn't have access to this site.`)
        console.error(`Response was: ${response.status}`)
    }

    if (response.status >= 300) {
        if (response.status === 429) {
            console.error("🚦 Rate limit exceeded, try again later.")
            console.error("")
            console.error("   Quota: https://developers.google.com/search/apis/indexing-api/v3/quota-pricing#quota")
            console.error("   Usage: https://console.cloud.google.com/apis/enabled")
            console.error("")
        } else {
            console.error(`❌ Failed to request indexing.`)
            console.error(`Response was: ${response.status}`)
            console.error(await response.text())
        }
    }
}
