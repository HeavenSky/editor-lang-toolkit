# Editor Lang Toolkit

[![VS Marketplace](https://vsmarketplacebadges.dev/version-short/HeavenSky.editor-lang-toolkit.svg?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![Installs](https://vsmarketplacebadges.dev/installs-short/HeavenSky.editor-lang-toolkit.svg)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.txt)

**English** · [简体中文](./README.zh-cn.md)

Language support for **YAML**, **TOML** and **ANSI-coloured text** — schema validation, completion, hover, formatting, navigation and terminal colours.

Both language servers are bundled. There is no CLI tool to install, no toolchain to configure, and no telemetry.

---

## Why this extension exists

VS Code ships a complete language service for JSON. For YAML it ships only a TextMate grammar. For TOML it ships nothing at all.

|                                   | JSON | YAML       | TOML       |
| --------------------------------- | ---- | ---------- | ---------- |
| Syntax highlighting, built in     | yes  | yes        | **no**     |
| Language service, built in        | yes  | **no**     | **no**     |
| Provided by this extension        | —    | **yes**    | **yes**    |

Most extensions that fill these gaps ask you to install a binary first — `taplo`, `buf`, a formatter, a linter. That model makes sense for a *tool* extension. It does not make sense for a *language* extension: opening a config file should just work.

---

## Features

### YAML

Powered by a bundled copy of [yaml-language-server](https://github.com/redhat-developer/yaml-language-server).

**Validation**

- JSON Schema, drafts 04 / 07 / 2019-09 / 2020-12
- Unused anchor detection
- Flow-style rules (`yaml.style.flowMapping`, `yaml.style.flowSequence`)
- Mapping key order (`yaml.keyOrdering`)
- Kubernetes CRD schemas

![YAML validation against a JSON Schema](./media/screenshots/yaml-validation.png)

**Schema discovery** — four ways, in priority order:

1. A modeline: `# yaml-language-server: $schema=<url>`
2. An inline `$schema` property
3. The `yaml.schemas` setting
4. The [SchemaStore](https://www.schemastore.org/) catalog, matched automatically by filename

**Editing** — completion, hover, document symbols, folding, go-to-definition for anchors, rename, document links, selection ranges, code actions, code lenses, formatting and format-on-type.

![YAML completion from a JSON Schema](./media/screenshots/yaml-completion.png)

### TOML

Powered by a bundled WebAssembly build of [Taplo](https://github.com/tamasfe/taplo).

- Syntax highlighting with semantic tokens
- JSON Schema validation, with associations from `.taplo.toml` or from settings
- Completion, hover, document symbols, folding, rename, document links
- Formatting, configurable through `.taplo.toml` or the `langToolkit.taplo` setting

![TOML highlighting and schema validation](./media/screenshots/toml-validation.png)

A `.taplo.toml` in your workspace is picked up automatically — the same file the `taplo` CLI reads, so editor and CI stay in sync without duplicating configuration.

### ANSI

Captured terminal output is rendered with its real colours instead of raw escape codes.

- **Full SGR coverage** — 16 colours and their bright variants, 256-colour (`38;5;n`) and **true colour** (`38;2;r;g;b`); bold, faint, italic, underline, double underline, strikethrough, overline, inverse and conceal
- **Colours follow your theme** — mapped to VS Code's `terminal.ansi*` palette, so there is nothing to configure and nothing to keep in sync with your colour scheme
- **Control sequences are recognised, not mangled** — cursor moves and line clears are dimmed rather than rendered as garbage. That matters more than it sounds: progress bars, spinners and `docker build` output are made almost entirely of them
- **Preview opens a real editor**, not a webview — search, selection, copy and side-by-side scrolling all behave normally, because it *is* an editor

![ANSI colouring and preview](./media/screenshots/ansi-preview.png)

Colouring applies to the `ansi` language (`.ans`, `.ansi`). To cover other files:

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

That trades away the built-in `log` grammar's timestamp highlighting. It is worth it when the file actually contains escape codes — that grammar renders them as noise anyway.

---

## Requirements

None. Both language servers are bundled.

---

## Commands

All commands are under the **Lang Toolkit** category in the Command Palette.

| Command | Description |
| --- | --- |
| `Restart Language Servers` | Restarts both servers without reloading the window |
| `Check for TOML Grammar Updates` | Fetches the grammar now instead of waiting for the weekly check |
| `Open ANSI Preview` | Opens the current file with escape sequences stripped |
| `Open ANSI Preview to the Side` | The same, in a side-by-side editor |

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `langToolkit.yaml.enabled` | `true` | Run the YAML language server. Syntax highlighting is unaffected. |
| `langToolkit.toml.enabled` | `true` | Run the TOML language server. Syntax highlighting is unaffected. |
| `langToolkit.taplo` | `{}` | Settings handed to Taplo, in camelCase. See the [Taplo reference](https://taplo.tamasfe.dev/configuration/file.html). |
| `langToolkit.toml.grammarUpdate.enabled` | `true` | Check weekly for a newer TOML grammar in the background. |
| `langToolkit.toml.grammarUpdate.url` | upstream grammar | Where that grammar is fetched from. |

YAML schema associations use the standard `yaml.schemas` and `yaml.schemaStore.*` keys, which `yaml-language-server` reads directly — existing configuration keeps working unchanged.

ANSI colouring has **no settings**. Colours come from your theme.

---

## Network access

Two things reach the network. Both can be turned off, and neither sends anything about you.

| What | When | How to disable |
| --- | --- | --- |
| JSON Schemas referenced by your files, plus the SchemaStore catalog | On demand, while editing | `langToolkit.yaml.enabled` / `langToolkit.toml.enabled` |
| The upstream TOML TextMate grammar | Once a week, in the background | `langToolkit.toml.grammarUpdate.enabled` |

Downloaded grammar content is rejected unless it parses as JSON and declares the `source.toml` scope, and it is written atomically — a bad response cannot corrupt the bundled grammar.

**There is no telemetry.**

---

## Size

Bundling two language servers costs space:

| Component | Size |
| --- | --- |
| `out/extension.js` — client, YAML server, Taplo glue | ~1.7 MB |
| `out/taplo.wasm` | ~25 MB (~6.6 MB compressed) |

Taplo publishes its WebAssembly as base64 inlined into a 34 MB JavaScript file. This extension extracts it into a standalone `.wasm` at build time, cutting roughly a third off the download — base64's 4/3 expansion is not something gzip can compress back to the density of the raw binary.

Neither server starts until you open a matching file.

---

## Known limitations

- **TOML grammar updates need a window reload.** `contributes.grammars` is read when the extension loads, so a newly downloaded grammar cannot take effect in the running window. This is a VS Code mechanism, not something the extension can work around.
- **ANSI colouring is tied to the `ansi` language id.** Use `files.associations` to extend it to other files; there is no regex-based opt-in, because that would require activating the extension on every window start.
- **True-colour output creates many decoration types.** They are capped at 512 and evicted least-recently-used, so a heavily coloured log will reuse rather than accumulate them. Types still shown in a visible editor are never evicted, so the cap is soft: if the visible ANSI documents need more than 512 style combinations at once, the cache temporarily grows to that size and shrinks back once they are no longer visible.
- **YAML formatting is Prettier.** The `yaml.format.*` settings are Prettier options passed through. If you already run Prettier in CI, the two agree by construction.

---

## Credits

This extension stands on three upstream projects, all MIT licensed:

- [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) — Red Hat
- [Taplo](https://github.com/tamasfe/taplo) — Ferenc Tamás
- [vscode-ansi](https://github.com/iliazeus/vscode-ansi) — Ilia Pozdnyakov, whose ANSI parser is used here

Full attributions are in [NOTICE.md](./NOTICE.md).

## Development

```bash
npm ci
npm run check       # icon, manifest, l10n and template drift gates
npm run typecheck
npm test
npm run package     # build artifacts/<name>-<version>.vsix and assert its contents
```

With npm 12, `npm ci` only accepts a lockfile resolved from `registry.npmjs.org`, and dependency install scripts (`esbuild`, `@vscode/vsce-sign`, `fsevents`) are skipped by default. None of them is needed to check, test or package; approve one with `npm install-scripts approve <package>` only if signing or publishing locally fails. CI uses the npm bundled with the Node version in `.nvmrc` and is not affected.

`npm run shots` regenerates the feature screenshots by hand (macOS; a VS Code window pops up while it runs) and writes them to `media/screenshots/`. Screenshots are not part of packaging or publishing.

## License

MIT — see [LICENSE.txt](./LICENSE.txt).
