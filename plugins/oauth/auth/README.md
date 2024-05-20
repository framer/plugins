# OAuth Cloudflare Worker for Framer Plugins

This is an example worker implementation that proxies OAuth 2.0 login requests using a client secret.

This was created and tested for Googles API. However, it should be generic enough (with some tweaks and fixes) to use with any other provider that supports [OAuth 2.0 Authorization Code Flow](https://aaronparecki.com/oauth-2-simplified/#web-server-apps).

## Setup

### Environment variables

The following environment variables need to be added via the CloudFlare console or CLI.

| Name               | Details                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| REDIRECT_URI       | Callback path that provider will redirect to after logging in                                                           |
| AUTHORIZE_ENDPOINT | Provider endpoint path for showing the log in screen                                                                    |
| TOKEN_ENDPOINT     | Provider endpoint path for fetching and refreshing access tokens                                                        |
| SCOPE              | Provider permissions separated by a space                                                                               |
| PLUGIN_URI         | Root path of where your plugin is hosted. This is used to send access tokens via `postMessage`                          |
| CLIENT_ID          | App ID created in the providers developer console                                                                       |
| CLIENT_SECRET      | App secret key created in the providers developer console. **Do not expose** in source code or send back to the client! |

To test locally, create a `.dev.vars` file with your own `CLIENT_ID` and `CLIENT_SECRET`:

```txt
REDIRECT_URI=http://localhost:8787/redirect
AUTHORIZE_ENDPOINT=https://accounts.google.com/o/oauth2/v2/auth
TOKEN_ENDPOINT=https://oauth2.googleapis.com/token
SCOPE=https://www.googleapis.com/auth/userinfo.profile
PLUGIN_URI=https://localhost:5174

CLIENT_ID=XXXXX
CLIENT_SECRET=XXXX
```
