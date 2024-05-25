import crypto from "node:crypto";

export function generateRandomId(): string {
  const array = new Uint8Array(16);
  crypto.webcrypto.getRandomValues(array);

  let id = "";

  for (let i = 0; i < array.length; i++) {
    id += array[i].toString(16).padStart(2, "0");
  }

  return id;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);

    // Generate an authorization URL to login into the provider, and a set of
    // read and write keys for retrieving the access token later on.
    if (
      request.method === "POST" &&
      requestUrl.pathname.startsWith("/authorize")
    ) {
      const readKey = generateRandomId();
      const writeKey = generateRandomId();

      const authorizeParams = new URLSearchParams();
      authorizeParams.append("client_id", env.CLIENT_ID);
      authorizeParams.append("redirect_uri", env.REDIRECT_URI);
      authorizeParams.append("scope", env.SCOPE);
      authorizeParams.append("response_type", "code");
      authorizeParams.append("access_type", "online");
      authorizeParams.append("include_granted_scopes", "true");

      // The write key is stored in the `state` param since this will be
      // persisted through the entire OAuth flow.
      authorizeParams.append("state", writeKey);

      // Generate the login URL for the provider.
      const authorizeUrl = new URL(env.AUTHORIZE_ENDPOINT);
      authorizeUrl.search = authorizeParams.toString();

      await env.keyValueStore.put(`readKey:${writeKey}`, readKey, {
        expirationTtl: 60,
      });

      const response = JSON.stringify({
        url: authorizeUrl.toString(),
        readKey,
      });

      return new Response(response, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Once the user has been authorized via login page, the provider will
    // redirect them back this URL with an access code (not an access token) and
    // the write key we stored in the state param.
    if (
      request.method === "GET" &&
      requestUrl.pathname.startsWith("/redirect")
    ) {
      const authorizationCode = requestUrl.searchParams.get("code");
      const writeKey = requestUrl.searchParams.get("state");

      if (!authorizationCode) {
        return new Response("Missing authorization code URL param", {
          status: 400,
        });
      }

      if (!writeKey) {
        return new Response("Missing state URL param", {
          status: 400,
        });
      }

      // Generate a new URL with the access code and client secret.
      const tokenParams = new URLSearchParams();
      tokenParams.append("client_id", env.CLIENT_ID);
      tokenParams.append("client_secret", env.CLIENT_SECRET);
      tokenParams.append("redirect_uri", env.REDIRECT_URI);
      tokenParams.append("grant_type", "authorization_code");
      tokenParams.append("code", authorizationCode);

      const tokenUrl = new URL(env.TOKEN_ENDPOINT);
      tokenUrl.search = tokenParams.toString();

      // This additional POST request retrieves the access token and expiry
      // information used for further API requests to the provider.
      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: "POST",
      });

      if (tokenResponse.status !== 200) {
        return new Response(tokenResponse.statusText, {
          status: tokenResponse.status,
        });
      }

      const readKey = await env.keyValueStore.get(`readKey:${writeKey}`);

      if (!readKey) {
        return new Response("No read key found in storage", {
          status: 400,
        });
      }

      // Store the tokens temporarily inside a key value store. This will be
      // retrieved when the plugin polls for them.
      const tokens = (await tokenResponse.json()) as unknown;
      env.keyValueStore.put(`tokens:${readKey}`, JSON.stringify(tokens), {
        expirationTtl: 300,
      });

      return new Response("You can now go back to Framer", {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    if (request.method === "POST" && requestUrl.pathname.startsWith("/poll")) {
      const readKey = requestUrl.searchParams.get("readKey");

      if (!readKey) {
        return new Response("Missing read key URL param", {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const tokens = await env.keyValueStore.get(`tokens:${readKey}`);

      if (!tokens) {
        return new Response(null, {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }

      // Even though the tokens have an expiry, it's important to delete them on
      // our side to reduce the reliability of storing user's sensitive data.
      await env.keyValueStore.delete(`tokens:${readKey}`);

      return new Response(tokens, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname.startsWith("/refresh")
    ) {
      const refreshToken = requestUrl.searchParams.get("code");

      if (!refreshToken) {
        return new Response("Missing refresh token URL param", {
          status: 400,
        });
      }

      const refreshParams = new URLSearchParams();
      refreshParams.append("refresh_token", refreshToken);
      refreshParams.append("client_id", env.CLIENT_ID);
      refreshParams.append("client_secret", env.CLIENT_SECRET);
      refreshParams.append("grant_type", "refresh_token");

      const refreshUrl = new URL(env.TOKEN_ENDPOINT);
      refreshUrl.search = refreshParams.toString();

      const refreshResponse = await fetch(refreshUrl.toString(), {
        method: "POST",
      });

      if (refreshResponse.status !== 200) {
        return new Response(refreshResponse.statusText, {
          status: refreshResponse.status,
        });
      }

      const tokens = await refreshResponse.json();
      return new Response(JSON.stringify(tokens));
    }

    return new Response();
  },
};
