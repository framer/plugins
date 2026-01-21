# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A monorepo of Framer plugins - small React apps that interact with the Framer editor. Contains ~35 plugins in `/plugins`, shared configuration packages in `/packages`, and starter templates in `/starters`.

## Commands

```bash
# Development
yarn dev --filter=[plugin-name]     # Start dev server for a plugin
yarn build --filter=[plugin-name]   # Build a plugin

# Code Quality (run before committing)
yarn check --filter=[plugin-name]   # Run all checks (biome, eslint, typescript, vitest)
yarn fix-biome                      # Auto-fix formatting
yarn fix-eslint -- --fix            # Auto-fix lint issues

# Individual checks
yarn turbo run check-typescript --filter=[plugin-name]
yarn turbo run check-eslint --filter=[plugin-name]
yarn turbo run check-biome --filter=[plugin-name]
```

## Architecture

**Package Manager:** Yarn 4 workspaces
**Build Orchestration:** Turbo
**Bundler:** Vite with React SWC

### Plugin Structure
Each plugin is a standalone React app:
- `framer.json` - Plugin metadata (id, name, modes)
- `src/main.tsx` - Entry point with framer-plugin initialization
- `src/App.tsx` - Main component
- `src/dataSources.ts` - Data source definitions (for CMS plugins)
- `src/data.ts` - Sync logic and data transformation

### Shared Packages
- `@framer/eslint-config` - ESLint flat config with TypeScript-ESLint
- `@framer/vite-config` - Vite config with React, Tailwind, HTTPS

### Key Dependencies
- `framer-plugin` - Official Framer plugin SDK
- `valibot` - Schema validation (used instead of zod)
- React 18 with TypeScript

## Code Style

**Formatting (Biome):**
- 4 spaces indentation, 120 char line width
- No semicolons, ES5 trailing commas
- Arrow functions without parens for single params

**TypeScript:**
- Strict mode, ES2023 target
- Use `type` imports for type-only imports

## Plugin Patterns

**Data Persistence:** Use `framer.getPluginData()` / `setPluginData()` for storing configuration

**CMS Plugins:** Follow the pattern in greenhouse/ashby plugins:
- `dataSources.ts` defines data sources with fields and fetch functions
- `data.ts` handles sync logic with `getItems()` and `syncCollection()`
- Collection references use `collectionReference` / `multiCollectionReference` field types
- `isMissingReferenceField()` checks if referenced collection exists

**Field Mapping:** Multiple fields can reference the same source key with different `getValue` transformers
