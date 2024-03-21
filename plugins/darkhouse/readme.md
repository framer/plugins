# Framer Plugin Template

## Quickstart

```
git clone git@github.com:framer/plugin.git; cd plugin; yarn; yarn run dev
```

This is a template for using the Framer Plugin API in a TypeScript project.

-   You need a [special branch of Framer](https://features-plugin.beta.framer.com/projects/) to use this library: `features/plugin`.
-   You can run the plugin in a local server by running `yarn dev`. It might ask you for a password so it can make `https` work using `mkcert`.
-   You can load the plugin in Framer by clicking `Plugins` in the toolbar and entering the local URL of the plugin (like https://localhost:5173).

## Notes

-   This is a work in progress. The API is not stable yet.
-   You can follow the work [here on Notion](https://www.notion.so/framer/Plugin-Documentation-f0b858563f2c46259906216fe42abfd7)
-   The API lives in the template for now, but will be moved to a separate package in the future.
-   `framer/plugin` is a mirror of the [main repository](https://github.com/framer/FramerStudio/tree/features/plugin/src/framer-plugin-api). If it's out of date, please run `make publish` to update it.
