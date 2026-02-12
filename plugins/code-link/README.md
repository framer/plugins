# Framer Code Link

Two-way sync between Framer code components and your local filesystem.

**By:** [@huntercaron](https://github.com/huntercaron)

<img src="../../assets/code-link.png" width="600" alt="Code Link">

## Features

- **Instant two-way sync** — Edits in locally instantly appear in Framer, and vice-versa
- **Automatic types** — TypeScript types for `framer`, `framer-motion`, `react` are automatically installed
- **Smart conflict resolution** — Auto-resolves when safe, prompts you to choose when both sides change
- **Zero config** — Creates config files on first run; re-run with just `npx framer-code-link`
- **AI skill** — Installs Framer component best-practices skill for Cursor, Claude, etc

## Quick Start

1. Open the **Code Link** Plugin in your Framer project
2. Copy the CLI command from the Plugin, eg. `npx framer-code-link (hash)`
3. Paste and run the command in your terminal
4. Edit files in `{project}/files/` — changes sync to Framer

## CLI Options

| Flag | Description |
| --- | --- |
| `-n, --name <name>` | Project name for the created directory |
| `-d, --dir <directory>` | Target project directory |
| `-v, --verbose` | Enable debug logging |