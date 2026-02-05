# framer-plugin-tools

CLI tools for building and packaging Framer plugins.

## Installation

```bash
npm install -g framer-plugin-tools
```

Or use directly with npx:

```bash
npx framer-plugin-tools pack
```

## Usage

### `pack`

Builds your plugin and creates a `plugin.zip` file ready for submission to the Framer Marketplace.

```bash
framer-plugin-tools pack
```

This command will:

1. Run `npm run build` in the current directory
2. Create a `plugin.zip` from the `dist/` folder

For custom options (e.g., custom build command, different output directory), run:

```bash
framer-plugin-tools pack --help
```


## Submitting Your Plugin

After running `pack`, submit your plugin at:
https://www.framer.com/marketplace/dashboard/plugins/
