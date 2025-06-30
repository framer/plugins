import { API_BASE_URL, PLUGIN_KEYS } from "./api"
import { generateRandomId } from "./utils"

type Tokens = {
    bearer_token: string
}

interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

class Auth {
    private readonly NOTION_CLIENT_ID = "3504c5a7-9f75-4f87-aa1b-b735f8480432"
    storedTokens?: Tokens | null

    logout() {
        this.tokens.clear()
    }

    async getTokens() {
        const tokens = this.tokens.get()
        if (!tokens) return null

        return tokens
    }

    async fetchTokens(readKey: string) {
        const res = await fetch(`${API_BASE_URL}/auth/authorize/${readKey}`, {
            method: "GET",
        })

        if (res.status !== 200) {
            throw new Error("Failed to fetch tokens")
        }

        const { token } = await res.json()
        this.tokens.save({ bearer_token: token })
        return token
    }

    async authorize(): Promise<Authorize> {
        const writeKey = generateRandomId()
        const readKey = generateRandomId()

        const res = await fetch(`${API_BASE_URL}/auth/authorize`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ readKey, writeKey }),
        })

        if (res.status !== 200) {
            throw new Error("Failed to generate OAuth URL")
        }

        const oauthRedirectUrl = encodeURIComponent(`${API_BASE_URL}/auth/authorize/callback`)

        return {
            writeKey,
            readKey,
            url: `https://api.notion.com/v1/oauth/authorize?client_id=${this.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${oauthRedirectUrl}&state=${writeKey}`,
        }
    }

    private readonly tokens = {
        save: (tokens: Tokens) => {
            this.storedTokens = tokens
            localStorage.setItem(PLUGIN_KEYS.BEARER_TOKEN, tokens.bearer_token)
        },
        get: () => {
            if (this.storedTokens) return this.storedTokens

            const bearerToken = localStorage.getItem(PLUGIN_KEYS.BEARER_TOKEN)
            if (!bearerToken) return null

            const storedTokens = { bearer_token: bearerToken } as Tokens
            this.storedTokens = storedTokens

            return storedTokens
        },
        clear: () => {
            this.storedTokens = null
            localStorage.removeItem(PLUGIN_KEYS.BEARER_TOKEN)
        },
    }
}

export default new Auth()
