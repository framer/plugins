export interface Tokens {
    access_token: string
    token_type: "bearer"
    scope: string
}

export interface StoredTokens {
    createdAt: number
    accessToken: string
    scope: string
}

export interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

const PLUGIN_TOKENS_KEY = "dribbbleTokens"
const isLocal = () => window.location.hostname.includes("localhost")
export const AUTH_URI = isLocal() ? "https://localhost:8787" : "https://oauth.fetch.tools/dribbble-plugin"

class Auth {
    storedTokens?: StoredTokens | null

    async authorize() {
        const res = await fetch(`${AUTH_URI}/authorize`, {
            method: "POST",
        })

        if (res.status !== 200) {
            throw new Error("Failed to generate OAuth URL.")
        }

        return (await res.json()) as Authorize
    }

    async fetchTokens(readKey: string) {
        const res = await fetch(`${AUTH_URI}/poll?readKey=${readKey}`, {
            method: "POST",
        })

        if (res.status !== 200) {
            throw new Error("Something went wrong polling for tokens.")
        }

        const tokens = (await res.json()) as Tokens

        this.tokens.save(tokens)
        return tokens
    }

    isAuthenticated() {
        const tokens = this.tokens.get()
        if (!tokens) return false

        return true
    }

    logout() {
        this.tokens.clear()
    }

    public readonly tokens = {
        save: (tokens: Tokens) => {
            const storedTokens: StoredTokens = {
                createdAt: Date.now(),
                accessToken: tokens.access_token,
                scope: tokens.scope,
            }

            this.storedTokens = storedTokens
            window.localStorage.setItem(PLUGIN_TOKENS_KEY, JSON.stringify(storedTokens))

            return storedTokens
        },
        get: (): StoredTokens | null => {
            if (this.storedTokens) return this.storedTokens

            const serializedTokens = window.localStorage.getItem(PLUGIN_TOKENS_KEY)
            if (!serializedTokens) return null

            const storedTokens = JSON.parse(serializedTokens) as StoredTokens

            this.storedTokens = storedTokens
            return storedTokens
        },
        getOrThrow: (): StoredTokens => {
            const tokens = this.tokens.get()
            if (!tokens) {
                throw new Error("Dribbble API token missing")
            }

            return tokens
        },
        clear: () => {
            this.storedTokens = null
            window.localStorage.removeItem(PLUGIN_TOKENS_KEY)
        },
    }
}

export default new Auth()
