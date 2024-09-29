interface Generation {
    caption: string
    image: string
}

interface GeneratedCaptionResponse {
    data: Generation[]
    error: {
        message: string
    } | null
}

const isLocal = () => window.location.hostname.includes("localhost")

const API_URL = isLocal() ? "http://localhost:8787" : "https://magic-alt-plugin-api.sakibulislam25800.workers.dev"

export async function generateCaptions(siteUrl: string, images: string[]): Promise<GeneratedCaptionResponse> {
    const res = await fetch(`${API_URL}/generate-alt-text`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ siteUrl, images }),
    })

    const json = await res.json()
    const error = json.error

    if (error) {
        throw new Error(error.message)
    }

    return json
}
