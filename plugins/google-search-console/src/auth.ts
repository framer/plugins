import { createContext, useCallback, useEffect, useRef, useState } from "react"
import * as v from "valibot"
import { AuthorizeSchema, type GoogleToken, GoogleTokenSchema } from "./types"

export const AccessTokenContext = createContext<string>("NO_ACCESS_TOKEN")

const STORAGE_KEY = "framer-search-console-tokens"

export function getLocalStorageTokens(): GoogleToken | null {
    const serializedTokens = window.localStorage.getItem(STORAGE_KEY)
    if (!serializedTokens) return null
    return v.parse(GoogleTokenSchema, JSON.parse(serializedTokens))
}

export function useGoogleToken() {
    const [loading, setLoading] = useState(false)
    const pollInterval = useRef<ReturnType<typeof setInterval>>()

    const pollForTokens = (readKey: string): Promise<GoogleToken> => {
        // Clear any previous interval timers, one may already exist
        // if this function was invoked multiple times.
        if (pollInterval.current) {
            clearInterval(pollInterval.current)
        }

        return new Promise((resolve, reject) => {
            window.setTimeout(reject, 60_000) // Timeout after 60 seconds

            const task = async () => {
                const response = await fetch(`${import.meta.env.VITE_OAUTH_API_DOMAIN}/poll?readKey=${readKey}`, {
                    method: "POST",
                })

                if (response.status === 200) {
                    const tokens = v.parse(GoogleTokenSchema, await response.json())

                    clearInterval(pollInterval.current)
                    resolve(tokens)
                }
            }

            pollInterval.current = setInterval(() => void task(), 1500)
        })
    }

    const [tokens, setTokens] = useState<GoogleToken | null>(null)
    const [isReady, setIsReady] = useState(false)

    useEffect(() => {
        // Check for tokens on first load.
        const serializedTokens = window.localStorage.getItem(STORAGE_KEY)

        if (serializedTokens) {
            const tokens = v.parse(GoogleTokenSchema, JSON.parse(serializedTokens))
            setTokens(tokens)
        }

        setIsReady(true)
    }, [])

    const login = () => {
        const task = async () => {
            try {
                setLoading(true)

                // Retrieve the authorization URL & set of unique read/write keys
                const response = await fetch(`${import.meta.env.VITE_OAUTH_API_DOMAIN}/authorize`, {
                    method: "POST",
                })
                if (response.status !== 200) return

                const authorize = v.parse(AuthorizeSchema, await response.json())

                // Open up the provider's login window.
                window.open(authorize.url)

                // While the user is logging in, poll the backend with the
                // read key. On successful login, tokens will be returned.
                const tokens = await pollForTokens(authorize.readKey)

                // Store tokens in local storage to keep the user logged in.
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

                // Update the component state.
                setTokens(tokens)
            } finally {
                setLoading(false)
            }
        }

        void task()
    }

    const refresh = useCallback(async (): Promise<GoogleToken | null> => {
        const refreshToken = tokens?.refresh_token

        try {
            if (!refreshToken) {
                setTokens(null)
                return null
            }

            // Retrieve the authorization URL & set of unique read/write keys
            const response = await fetch(
                `${import.meta.env.VITE_OAUTH_API_DOMAIN}/refresh?code=${encodeURIComponent(refreshToken)}`,
                {
                    method: "POST",
                }
            )

            const tokens = v.parse(GoogleTokenSchema, await response.json())

            if (response.ok) {
                tokens.refresh_token ??= refreshToken

                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

                setTokens(tokens)

                return tokens
            } else {
                setTokens(null)

                return null
            }
        } catch (e) {
            setTokens(null)

            return null
        }
    }, [tokens?.refresh_token])

    const logout = () => {
        window.localStorage.removeItem(STORAGE_KEY)
        setTokens(null)
    }

    return { isReady, login, refresh, tokens, logout, loading }
}
