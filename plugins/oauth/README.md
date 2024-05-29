# Example Plugin using OAuth

An example Framer Plugin that uses a backend for OAuth 2.0.

See our [Implementing OAuth guide](https://developers.framer.wiki/docs/oauth) on how to set this up.

## Overview

There are two parts to this example, the **plugin** frontend and **backend**. This is the frontend for the plugin, the backend can be found in this repo: https://github.com/framer/plugin-oauth

## Setup

Both the plugin and backend need to be run. To do this, open both in separate terminals and run:

```sh
npm install
npm run dev
```

You should see the plugin hosted at `https://localhost:5174` and the worker at `https://localhost:8787`.

Open up Framer and use "Open Plugin URL...", entering the plugin path.
