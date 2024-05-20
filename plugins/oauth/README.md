# Example Plugin using OAuth 2.0

An example Framer Plugin that uses OAuth 2.0 with a client secret ([Authorization Code Flow](https://aaronparecki.com/oauth-2-simplified/#web-server-apps)).

## Overview

There are two parts to this example, the **plugin** and authentication **backend**. These are found in the `./plugin` and `./auth` directories respectively.

The backend is a Node.js CloudFlare Worker, and it's used to hide a client secret and proxy authentication requests to the provider. The provider in this example is Google.

While CloudFlare Workers are used, the backend doesn't rely on CloudFlare specific features or any third-party router libraries.

With some tweaks the backend could implemented for any other kind of cloud function service (e.g AWS Lambda), or a HTTP server (e.g Express).

## Local development

### Create a client ID and secret

Setup a developer account and app with the API provider. In this example we're using Google, so use the [Google Developer Console](https://console.cloud.google.com/) to create an app and credentials.

You'll also need to ensure the correct scopes are enabled, these are permissions. This example only requires a basic `userinfo.profile` scope, which does not need anything special added in the Google Developer Console.

### Add environment variables

Open up two terminal windows, and `cd` into the `./plugin` directory in one, and `./auth` directory in the other.

In the `./auth` directory, create a new `.dev.vars` file with the following config, replacing `CLIENT_ID` and `CLIENT_SECRET` with your own.

```txt
REDIRECT_URI=http://localhost:8787/redirect
AUTHORIZE_ENDPOINT=https://accounts.google.com/o/oauth2/v2/auth
TOKEN_ENDPOINT=https://oauth2.googleapis.com/token
SCOPE=https://www.googleapis.com/auth/userinfo.profile
PLUGIN_URI=https://localhost:5174

CLIENT_ID=XXXXX
CLIENT_SECRET=XXXX
```

See the [worker README](./auth/README.md) for more details on each environment variable.

### Run both apps

Now in **both** directories, run:

```sh
npm install
npm run dev
```

You should see the plugin hosted at `https://localhost:5174` and the worker at `http://localhost:8787`.

> [!NOTE]
> If these URLs or port numbers are different from the ones here, you'll need to update the `REDIRECT_URI` and `PLUGIN_URI` environment variables in `.dev.vars`.
>
> Also update the redirect URI with worker address in the developer dashboard.

### Open in Framer

Open up Framer and use "Open Plugin URL...", entering the plugin path. E.g `https://localhost:5174`.
