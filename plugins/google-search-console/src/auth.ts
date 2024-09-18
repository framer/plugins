import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { GoogleToken } from './types';

export const AuthContext = createContext<GoogleToken | null>(null);

export function getLocalStorageTokens() {
  const serializedTokens = window.localStorage.getItem('tokens');

  if (serializedTokens) {
    const tokens = JSON.parse(serializedTokens);

    return tokens as GoogleToken;
  }

  return null;
}

export function useGoogleToken() {
  const pollInterval = useRef<number>();

  const pollForTokens = (readKey: string) => {
    // Clear any previous interval timers, one may already exist
    // if this function was invoked multiple times.
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    return new Promise((resolve) => {
      pollInterval.current = setInterval(async () => {
        const response = await fetch(
          `${import.meta.env.VITE_OAUTH_API_DOMAIN}/poll?readKey=${readKey}`,
          { method: 'POST' },
        );

        if (response.status === 200) {
          const tokens = await response.json();

          clearInterval(pollInterval.current);
          resolve(tokens);
        }
      }, 10_000);
    });
  };

  const [tokens, setTokens] = useState<GoogleToken | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check for tokens on first load.
    const serializedTokens = window.localStorage.getItem('tokens');

    if (serializedTokens) {
      const tokens = JSON.parse(serializedTokens);
      setTokens(tokens);
    }

    setIsReady(true);
  }, []);

  const login = async () => {
    // Retrieve the authorization URL & set of unique read/write keys
    const response = await fetch(
      `${import.meta.env.VITE_OAUTH_API_DOMAIN}/authorize`,
      {
        method: 'POST',
      },
    );
    if (response.status !== 200) return;

    const authorize = await response.json();

    // Open up the provider's login window.
    window.open(authorize.url);

    // While the user is logging in, poll the backend with the
    // read key. On successful login, tokens will be returned.
    const tokens = await pollForTokens(authorize.readKey);

    // Store tokens in local storage to keep the user logged in.
    window.localStorage.setItem('tokens', JSON.stringify(tokens));

    // Update the component state.
    setTokens(tokens as GoogleToken);
  };

  const refresh = useCallback(async (): Promise<GoogleToken | null> => {
    const refreshToken = tokens?.refresh_token;

    try {
      if (!refreshToken) {
        setTokens(null);
        return null;
      }

      // Retrieve the authorization URL & set of unique read/write keys
      const response = await fetch(
        `${import.meta.env.VITE_OAUTH_API_DOMAIN}/refresh?code=${encodeURIComponent(refreshToken)}`,
        {
          method: 'POST',
        },
      );

      const tokens = await response.json();

      if (response.ok) {
        if (!tokens.refresh_token) {
          tokens.refresh_token = refreshToken;
        }

        window.localStorage.setItem('tokens', JSON.stringify(tokens));

        setTokens(tokens as GoogleToken);

        return tokens;
      } else {
        setTokens(null);

        return null;
      }
    } catch (e) {
      setTokens(null);

      return null;
    }
  }, [tokens?.refresh_token]);

  const logout = () => {
    window.localStorage.removeItem('tokens');
    setTokens(null);
  };

  return { isReady, login, refresh, tokens, logout };
}
