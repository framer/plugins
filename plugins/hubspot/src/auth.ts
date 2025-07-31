import * as v from "valibot"
import { PluginError } from "./PluginError"

const TokensSchema = v.object({
    access_token: v.string(),
    refresh_token: v.string(),
    expires_in: v.number(),
    scope: v.string(),
    token_type: v.literal("Bearer"),
})

type Tokens = v.InferOutput<typeof TokensSchema>

const StoredTokensSchema = v.object({
    createdAt: v.number(),
    expiredIn: v.number(),
    accessToken: v.string(),
    refreshToken: v.string(),
})

type StoredTokens = v.InferOutput<typeof StoredTokensSchema>

const AuthorizeSchema = v.object({
    url: v.string(),
    writeKey: v.string(),
    readKey: v.string(),
})

type Authorize = v.InferOutput<typeof AuthorizeSchema>

const pluginTokensKey = "hubspotTokens"

const isLocal = () => window.location.hostname.includes("localhost")

const AUTH_URI = isLocal() ? "https://localhost:8787" : "https://oauth.framer.wtf/hubspot-plugin"

class Auth {
    storedTokens?: StoredTokens | null

    async refreshTokens(): Promise<StoredTokens> {
        try {
            const tokens = this.tokens.getOrThrow()

            const res = await fetch(`${AUTH_URI}/refresh?code=${tokens.refreshToken}`, {
                method: "POST",
            })

            if (res.status !== 200) {
                this.logout()
                throw new PluginError("Refresh Failed", "Failed to refresh tokens.")
            }

            return this.tokens.save(v.parse(TokensSchema, await res.json()))
        } catch (e) {
            this.tokens.clear()
            throw e
        }
    }

    async fetchTokens(readKey: string): Promise<StoredTokens> {
        const res = await fetch(`${AUTH_URI}/poll?readKey=${readKey}`, {
            method: "POST",
        })

        if (res.status !== 200) {
            throw new Error("Something went wrong polling for tokens.")
        }

        return this.tokens.save(v.parse(TokensSchema, await res.json()))
    }

    async authorize(): Promise<Authorize> {
        const response = await fetch(`${AUTH_URI}/authorize`, {
            method: "POST",
        })

        if (response.status !== 200) {
            throw new Error("Failed to generate OAuth URL.")
        }

        return v.parse(AuthorizeSchema, await response.json())
    }

    isTokensExpired() {
        const tokens = this.tokens.get()
        if (!tokens) return true

        const { createdAt, expiredIn } = tokens
        const expirationTime = createdAt + expiredIn * 1000

        return Date.now() >= expirationTime
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
            this.storedTokens = {
                createdAt: Date.now(),
                expiredIn: tokens.expires_in,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
            }

            window.localStorage.setItem(pluginTokensKey, JSON.stringify(this.storedTokens))

            return this.storedTokens
        },
        get: (): StoredTokens | null => {
            if (this.storedTokens) return this.storedTokens

            const serializedTokens = window.localStorage.getItem(pluginTokensKey)
            if (!serializedTokens) return null

            this.storedTokens = v.parse(StoredTokensSchema, JSON.parse(serializedTokens))

            return this.storedTokens
        },
        getOrThrow: (): StoredTokens => {
            const tokens = this.tokens.get()
            if (!tokens) throw new PluginError("Auth Error", "HubSpot API token missing")

            return tokens
        },
        clear: () => {
            this.storedTokens = null
            window.localStorage.removeItem(pluginTokensKey)
        },
    }
}

export default new Auth()
