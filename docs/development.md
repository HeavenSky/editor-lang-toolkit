# Build from source

**English** · [简体中文](../zh/docs/development.md)

This page shows how to check, test and package the extension from a clone; you need the Node.js version in [`.nvmrc`](../.nvmrc) and npm.

## Build and test

Run these five commands in order to go from a clean clone to a tested VSIX in `artifacts/`. The last one, `npm run package`, also asserts what goes into the package.

```bash
npm ci
npm run check       # icon, manifest, l10n and template drift gates
npm run typecheck
npm test
npm run package     # build artifacts/<name>-<version>.vsix and assert its contents
```

## Install scripts under npm 12

With npm 12, `npm ci` only accepts a lockfile resolved from `registry.npmjs.org`, and dependency install scripts (`esbuild`, `@vscode/vsce-sign`, `fsevents`) are skipped by default. None of them is needed to check, test or package. Approve one with `npm install-scripts approve <package>` only if signing or publishing locally fails. CI uses the npm bundled with the Node.js version in `.nvmrc` and is not affected.

## Regenerate the screenshots

`npm run shots` regenerates the README screenshots in `media/screenshots/`. It runs on macOS only and opens a VS Code window while it works. Screenshots are loaded from GitHub by the README and are not packaged.
