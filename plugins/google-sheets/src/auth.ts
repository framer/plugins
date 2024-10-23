interface Tokens {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
    token_type: "Bearer"
}

interface StoredTokens {
    createdAt: number
    expiredIn: number
    accessToken: string
    // When you have previously logged into the app with oAuth Google no longer gives a refresh token.
    // https://stackoverflow.com/a/10857806
    refreshToken: string | undefined
}

interface Authorize {
    url: string
    writeKey: string
    readKey: string
}

class Auth {
    private readonly PLUGIN_TOKENS_KEY = "googleSheetsTokens"
    private readonly AUTH_URI: string
    storedTokens?: StoredTokens | null

    constructor() {
        this.AUTH_URI = location.hostname.includes("localhost")
            ? "https://localhost:8787"
            : "https://oauth.fetch.tools/google-sheets-plugin"
    }

    logout() {
        this.tokens.clear()
    }

    async refreshTokens() {
        try {
            const tokens = this.tokens.get()
            if (!tokens) {
                throw new Error("Refresh attempted with no stored tokens.")
            }

            const res = await fetch(`${this.AUTH_URI}/refresh?code=${tokens.refreshToken}`, {
                method: "POST",
            })

            const newTokens = (await res.json()) as Tokens

            this.tokens.save(newTokens)

            return newTokens
        } catch (e) {
            this.tokens.clear()
            throw e
        }
    }

    async getTokens() {
        const tokens = this.tokens.get()
        if (!tokens) return null

        if (this.isTokensExpired()) {
            if (tokens.refreshToken) {
                await this.refreshTokens()
            } else {
                // After an app has previously authenticated with oAuth Google no longer gives a refresh token.
                // Unless we explicitly send users through the consent screens in every Login.
                // Instead of doing that we let them log in again.
                this.tokens.clear()
                return
            }
        }

        return this.tokens.get()
    }

    async fetchTokens(readKey: string): Promise<Tokens | undefined> {
        const res = await fetch(`${this.AUTH_URI}/poll?readKey=${readKey}`, {
            method: "POST",
        })

        if (res.status === 404) {
            return
        }

        if (res.status !== 200) {
            throw new Error("Failed to fetch tokens")
        }

        const tokens = (await res.json()) as Tokens
        this.tokens.save(tokens)
        return tokens
    }

    async authorize() {
        const res = await fetch(`${this.AUTH_URI}/authorize`, {
            method: "POST",
        })

        if (res.status !== 200) {
            throw new Error("Failed to generate OAuth URL")
        }

        const authorize = (await res.json()) as Authorize

        return authorize
    }

    private isTokensExpired() {
        const tokens = this.tokens.get()
        if (!tokens) return true

        const { createdAt, expiredIn } = tokens
        const expirationTime = createdAt + expiredIn * 1000

        return Date.now() >= expirationTime
    }

    private readonly tokens = {
        save: (tokens: Tokens) => {
            const storedTokens: StoredTokens = {
                createdAt: Date.now(),
                expiredIn: tokens.expires_in,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
            }

            this.storedTokens = storedTokens
            localStorage.setItem(this.PLUGIN_TOKENS_KEY, JSON.stringify(storedTokens))
        },
        get: () => {
            if (this.storedTokens) return this.storedTokens

            const serializedTokens = localStorage.getItem(this.PLUGIN_TOKENS_KEY)
            if (!serializedTokens) return null

            const storedTokens = JSON.parse(serializedTokens) as StoredTokens
            this.storedTokens = storedTokens

            return storedTokens
        },
        clear: () => {
            this.storedTokens = null
            localStorage.removeItem(this.PLUGIN_TOKENS_KEY)
        },
    }
}

export default new Auth()
