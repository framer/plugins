import { FramerSalesforceAPIErrorResponse } from "./api"
import { BACKEND_URL, BUSINESS_UNIT_ID_KEY } from "./constants"
import { PluginError } from "./PluginError"

export interface Tokens {
    access_token: string
    refresh_token: string
    instance_url: string
    id: string
    issued_at: string
    scope: string
    token_type: "Bearer"
    id_token?: string
    signature?: string
}

export interface StoredTokens {
    createdAt: number
    accessToken: string
    refreshToken: string
    instanceUrl: string
    id: string
}

export interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

const PLUGIN_TOKENS_KEY = "salesforceTokens"

class Auth {
    storedTokens?: StoredTokens | null

    async refreshTokens() {
        try {
            const tokens = this.tokens.getOrThrow()

            const res = await fetch(`${BACKEND_URL}/auth/refresh?code=${tokens.refreshToken}`, {
                method: "POST",
            })

            if (res.status !== 200) {
                throw new PluginError("Auth Error", "Failed to refresh tokens. Please sign in again.")
            }

            const json = await res.json()
            const newTokens = json as Tokens

            return this.tokens.save(newTokens)
        } catch (e) {
            this.tokens.clear()
            throw e
        }
    }

    async fetchTokens(readKey: string) {
        const res = await fetch(`${BACKEND_URL}/auth/poll?readKey=${readKey}`, {
            method: "POST",
        })

        if (!res.ok) {
            throw new PluginError("Auth Error", "Failed to fetch tokens")
        }

        const tokens = (await res.json()) as Tokens

        this.tokens.save(tokens)

        return tokens
    }

    async authorize() {
        const response = await fetch(`${BACKEND_URL}/auth/authorize`, {
            method: "POST",
        })

        if (response.status !== 200) {
            throw new PluginError("Auth Error", "Failed to generate OAuth URL.")
        }

        const authorize = (await response.json()) as Authorize

        return authorize
    }

    async logout() {
        const tokens = this.tokens.getOrThrow()
        const res = await fetch(`${BACKEND_URL}/auth/logout`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        })

        if (res.status !== 200) {
            const data: FramerSalesforceAPIErrorResponse = await res.json()
            throw new PluginError("Auth Error", data.error.message)
        }

        this.tokens.clear()
        localStorage.removeItem(BUSINESS_UNIT_ID_KEY)
    }

    getBusinessUnitId() {
        return localStorage.getItem(BUSINESS_UNIT_ID_KEY)
    }

    isAuthenticated() {
        const tokens = this.tokens.get()
        if (!tokens) return false

        return true
    }

    public readonly tokens = {
        save: (tokens: Tokens) => {
            const storedTokens: StoredTokens = {
                createdAt: parseInt(tokens.issued_at),
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                instanceUrl: tokens.instance_url,
                id: tokens.id,
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
                this.tokens.clear()
                throw new PluginError("Auth Error", "Salesforce API token missing from localstorage")
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
