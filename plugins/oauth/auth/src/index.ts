interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);

    if (
      request.method === "GET" &&
      requestUrl.pathname.startsWith("/authorize")
    ) {
      const authorizeParams = new URLSearchParams();
      authorizeParams.append("client_id", env.CLIENT_ID);
      authorizeParams.append("redirect_uri", env.REDIRECT_URI);
      authorizeParams.append("scope", env.SCOPE);
      authorizeParams.append("response_type", "code");
      authorizeParams.append("access_type", "online");
      authorizeParams.append("include_granted_scopes", "true");

      // Generate the login URL for the provider.
      const authorizeUrl = new URL(env.AUTHORIZE_ENDPOINT);
      authorizeUrl.search = authorizeParams.toString();

      // Redirect to providers login page.
      return Response.redirect(authorizeUrl.toString());
    }

    if (
      request.method === "GET" &&
      requestUrl.pathname.startsWith("/redirect")
    ) {
      // When the user has authorized via the login page, they will be
      // redirected back this URL with an access code.
      const authorizationCode = requestUrl.searchParams.get("code");

      if (!authorizationCode) {
        return new Response("Missing authorization code URL param", {
          status: 400,
        });
      }

      // Generate a new URL with the access code and client secret.
      const tokenParams = new URLSearchParams();
      tokenParams.append("code", authorizationCode);
      tokenParams.append("client_id", env.CLIENT_ID);
      tokenParams.append("client_secret", env.CLIENT_SECRET);
      tokenParams.append("redirect_uri", env.REDIRECT_URI);
      tokenParams.append("grant_type", "authorization_code");

      const tokenUrl = new URL(env.TOKEN_ENDPOINT);
      tokenUrl.search = tokenParams.toString();

      // This second request retrieves the access token and expiry information
      // used for further API requests to the provider.
      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: "POST",
      });

      if (tokenResponse.status !== 200) {
        return new Response(tokenResponse.statusText, {
          status: tokenResponse.status,
        });
      }

      // Send the access tokens back to the plugin via a window message.
      const tokens = (await tokenResponse.json()) as TokenResponse;
      const message = JSON.stringify({ type: "tokens", tokens });

      return new Response(
        `<script>
					window.addEventListener("message", (event) => {
						if (event.data.type === "close") {
							window.close();
						}
					});

					window.opener.postMessage(${message}, "${env.PLUGIN_URI}");
				</script>`,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
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
