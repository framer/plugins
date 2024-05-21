import { framer } from "framer-plugin";
import { useCallback, useEffect, useState } from "react";
import "./App.css";

framer.showUI({
  title: "OAuth Example",
  position: "top right",
  width: 240,
  height: 250,
});

interface TokensMessage {
  type: "tokens";
  tokens: {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: "Bearer";
  };
}

interface Tokens {
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

function isTokensMessage(eventData: unknown): eventData is TokensMessage {
  if (eventData === null) return false;
  if (typeof eventData !== "object") return false;
  if (!("type" in eventData)) return false;
  if (eventData.type !== "tokens") return false;

  return true;
}

export function App() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);

  const login = () => {
    // TODO(anthony): Using `state` param here to force redirect back to the
    // electron app after logging in. Ideally we'd have an API like `framer.isApp()`?
    window.open("http://localhost:8787/authorize?state=app");

    const handleMessage = (event: MessageEvent) => {
      if (!isTokensMessage(event.data)) return;

      // Tokens from Google are stored in `localStorage` along with a created at
      // timestamp.
      //
      // It's not implemented in this example, but the created at timestamp
      // would be used for checking when to refresh the tokens.
      const tokens: Tokens = {
        createdAt: Date.now(),
        expiredIn: event.data.tokens.expires_in,
        accessToken: event.data.tokens.access_token,
      };

      setTokens(tokens);
      window.localStorage.setItem("tokens", JSON.stringify(tokens));

      // Tell the authorization window it's safe to close itself.
      //
      // TODO: A type cast is used here because the signature for
      // `event.source.postMessage` does not include the target origin
      // parameter, but it's required for messages to work. Are the wrong DOM
      // types installed?
      (event.source as Window)?.postMessage({ type: "close" }, event.origin);

      // Clean up event listener so that they don't build up.
      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);
  };

  const logout = () => {
    setTokens(null);
    setProfile(null);
    window.localStorage.removeItem("tokens");
  };

  const getUserProfile = useCallback(async () => {
    if (!tokens) return;

    // Ideally you'd use official Google libraries to interact with their API,
    // but this is just an example of a standard way to Bearer tokens.
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

    const tokens = JSON.parse(serializedTokens) as Tokens;
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
