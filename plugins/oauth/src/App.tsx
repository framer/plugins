import { framer } from "framer-plugin";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

framer.showUI({
  title: "OAuth Example",
  position: "top right",
  width: 240,
  height: 250,
});

interface Authorize {
  url: string;
  writeKey: string;
  readKey: string;
}

interface Tokens {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
}

interface StoredTokens {
  createdAt: number;
  expiredIn: number;
  accessToken: string;
}

interface GoogleProfile {
  id: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

const isLocal = () => window.location.hostname.includes("localhost");

const AUTH_URI = isLocal()
  ? "https://localhost:8787"
  : "https://framer-plugin-oauth.framer-plugin-google-auth.workers.dev/";

export function App() {
  const pollInterval = useRef<number>();
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);

  const pollForTokens = (readKey: string): Promise<Tokens> => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }

    return new Promise((resolve) => {
      pollInterval.current = setInterval(async () => {
        const response = await fetch(`${AUTH_URI}/poll?readKey=${readKey}`, {
          method: "POST",
        });

        if (response.status === 200) {
          const tokens = (await response.json()) as Tokens;
          clearInterval(pollInterval.current);
          resolve(tokens);
        }
      }, 2500);
    });
  };

  const login = async () => {
    // Retrieve the authorization URL and a set of read and write keys.
    const response = await fetch(`${AUTH_URI}/authorize`, {
      method: "POST",
    });
    if (response.status !== 200) return;

    const authorize = (await response.json()) as Authorize;

    // Open up the providers login window.
    window.open(authorize.url);

    // Poll the authentication server with the read key, waiting for tokens.
    const tokens = await pollForTokens(authorize.readKey);

    // Augment the tokens from the provider with a `createdAt` timestamp. It's
    // not implemented in this example, but the `createdAt` timestamp would be
    // used for checking when to refresh the tokens.
    const storedTokens: StoredTokens = {
      createdAt: Date.now(),
      expiredIn: tokens.expires_in,
      accessToken: tokens.access_token,
    };

    // Store in local storage.
    window.localStorage.setItem("tokens", JSON.stringify(storedTokens));

    setTokens(storedTokens);
  };

  const logout = () => {
    setTokens(null);
    setProfile(null);
    window.localStorage.removeItem("tokens");
  };

  const getUserProfile = useCallback(async () => {
    if (!tokens) return;

    // Ideally you'd use official Google libraries to interact with their API,
    // but this is just an example of a standard way to use Bearer tokens.
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );
    const profile = await response.json();
    setProfile(profile);
  }, [tokens]);

  useEffect(() => {
    // Check for tokens on first load.
    const serializedTokens = window.localStorage.getItem("tokens");
    if (!serializedTokens) return;

    const tokens = JSON.parse(serializedTokens) as StoredTokens;
    setTokens(tokens);
  }, []);

  useEffect(() => {
    // Load the user profile if tokens exist.
    if (tokens) {
      getUserProfile();
    }
  }, [tokens, getUserProfile]);

  return (
    <main>
      {tokens ? (
        <button onClick={logout}>Log out</button>
      ) : (
        <button onClick={login}>Log in</button>
      )}
      {profile && <>Hello, {profile.given_name}!</>}
    </main>
  );
}
