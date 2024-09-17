export interface Tokens {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
    token_type: "Bearer"
}

export interface StoredTokens {
    createdAt: number
    expiredIn: number
    accessToken: string
    refreshToken: string
}

export interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

const pluginTokensKey = "hubspotTokens"

export const isLocal = () => window.location.hostname.includes("localhost")

export const AUTH_URI = isLocal()
    ? "https://localhost:8787"
    : "https://oauth.fetch.tools/hubspot-plugin"

class Auth {
    storedTokens?: StoredTokens | null

    async refreshTokens() {
        try {
            const tokens = this.tokens.getOrThrow()

            const res = await fetch(`${AUTH_URI}/refresh?code=${tokens.refreshToken}`, {
                method: "POST",
            })

            if (res.status !== 200) {
                throw new Error("Failed to refresh tokens. Please sign in again.")
            }

            const json = await res.json()
            const newTokens = json as Tokens

            this.tokens.save(newTokens)

            return newTokens
        } catch (e) {
            this.tokens.clear()
            throw e
        }
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

    async authorize() {
        const response = await fetch(`${AUTH_URI}/authorize`, {
            method: "POST",
        })

        if (response.status !== 200) {
            throw new Error("Failed to generate OAuth URL.")
        }

        const authorize = (await response.json()) as Authorize

        return authorize
    }

    isTokensExpired() {
        const tokens = this.tokens.get()
        if (!tokens) return true

        const { createdAt, expiredIn } = tokens
        const expirationTime = createdAt + expiredIn * 1000

        return Date.now() >= expirationTime
    }

    async isAuthenticated() {
        const tokens = this.tokens.get()
        if (!tokens) return false

        if (this.isTokensExpired()) {
            await this.refreshTokens()
        }

        return true
    }

    public readonly tokens = {
        save: (tokens: Tokens) => {
            const storedTokens: StoredTokens = {
                createdAt: Date.now(),
                expiredIn: tokens.expires_in,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
            }

            this.storedTokens = storedTokens
            window.localStorage.setItem(pluginTokensKey, JSON.stringify(storedTokens))
        },
        get: (): StoredTokens | null => {
            if (this.storedTokens) return this.storedTokens

            const serializedTokens = window.localStorage.getItem(pluginTokensKey)
            if (!serializedTokens) return null

            const storedTokens = JSON.parse(serializedTokens) as StoredTokens
            this.storedTokens = storedTokens

            return storedTokens
        },
        getOrThrow: (): StoredTokens => {
            const tokens = this.tokens.get()
            if (!tokens) throw new Error("HubSpot API token missing")

            return tokens
        },
        clear: () => {
            this.storedTokens = null
            window.localStorage.removeItem(pluginTokensKey)
        },
    }
}

export default new Auth()
