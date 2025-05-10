import { generateRandomId } from "./utils"

interface Tokens {
    bearer_token: string
}

interface StoredTokens {
    createdAt: number
    bearer_token: string
}

interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

class Auth {
    private readonly PLUGIN_TOKENS_KEY = "notionBearerToken"
    private readonly AUTH_URI = "https://notion-plugin-api.framer-team.workers.dev"
    private readonly NOTION_CLIENT_ID = "3504c5a7-9f75-4f87-aa1b-b735f8480432"
    storedTokens?: StoredTokens | null

    logout() {
        this.tokens.clear()
    }

    async getTokens() {
        const tokens = this.tokens.get()
        if (!tokens) return null

        return this.tokens.get()
    }

    async fetchTokens(readKey: string) {
        const res = await fetch(`${this.AUTH_URI}/auth/authorize/${readKey}`, {
            method: "GET",
        })

        if (res.status !== 200) {
            throw new Error("Failed to fetch tokens")
        }

        const { token } = await res.json()
        const tokens: Tokens = {
            bearer_token: token,
        }
        this.tokens.save(tokens)
        return tokens
    }

    async authorize(): Promise<Authorize> {
        const writeKey = generateRandomId()
        const readKey = generateRandomId()

        const res = await fetch(`${this.AUTH_URI}/auth/authorize`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ readKey, writeKey }),
        })

        if (res.status !== 200) {
            throw new Error("Failed to generate OAuth URL")
        }

        const oauthRedirectUrl = encodeURIComponent(`${this.AUTH_URI}/auth/authorize/callback`)

        return {
            writeKey,
            readKey,
            url: `https://api.notion.com/v1/oauth/authorize?client_id=${this.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${oauthRedirectUrl}&state=${writeKey}`,
        }
    }

    async isWorkerAlive(): Promise<boolean> {
        return true
        // try {
        //     const res = await fetch(`${this.AUTH_URI}/auth/authorize`, {
        //         method: "POST",
        //     })
        //     console.log("res", res)
        //     return res.status === 400
        // } catch (error) {
        //     console.error("Failed to connect to OAuth worker:", error)
        //     return false
        // }
    }

    private readonly tokens = {
        save: (tokens: Tokens) => {
            const storedTokens: StoredTokens = {
                createdAt: Date.now(),
                bearer_token: tokens.bearer_token,
            }

            this.storedTokens = storedTokens
            localStorage.setItem(this.PLUGIN_TOKENS_KEY, JSON.stringify(storedTokens))
        },
        get: () => {
            if (this.storedTokens) return this.storedTokens

            const serializedTokens = localStorage.getItem(this.PLUGIN_TOKENS_KEY)
            if (!serializedTokens) return null

            try {
                const storedTokens = JSON.parse(serializedTokens) as StoredTokens
                this.storedTokens = storedTokens

                return storedTokens
            } catch {
                return null
            }
        },
        clear: () => {
            this.storedTokens = null
            localStorage.removeItem(this.PLUGIN_TOKENS_KEY)
        },
    }
}

export default new Auth()
