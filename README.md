# Editor Lang Toolkit

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/HeavenSky.editor-lang-toolkit?label=marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.txt)

**English** · [简体中文](./README.zh-cn.md)

Language support for YAML and TOML — validation, completion, hover, formatting and navigation.
Both language servers ship inside the extension. There is nothing else to install.

## Why this exists

VS Code ships a full language service for JSON, but for YAML it ships only a TextMate grammar,
and for TOML it ships nothing at all. This extension fills both gaps, and does so without asking
you to install a CLI tool first — a language extension should work the moment it is installed.

|                                | JSON            | YAML              | TOML              |
| ------------------------------ | --------------- | ----------------- | ----------------- |
| Syntax highlighting, built in  | yes             | yes               | **no**            |
| Language service, built in     | yes             | **no**            | **no**            |
| Provided by this extension     | —               | **yes**           | **yes**           |

## Features

Everything below comes from the two bundled language servers. Nothing runs unless you open a
YAML or TOML file.

### YAML — powered by [yaml-language-server](https://github.com/redhat-developer/yaml-language-server)

- **Validation** against JSON Schema (draft-04, draft-07, 2019-09, 2020-12), including unused
  anchors, flow-style rules and mapping key order
- **Schema discovery** — modelines (`# yaml-language-server: $schema=…`), an inline `$schema`
  property, the `yaml.schemas` setting, and the [SchemaStore](https://www.schemastore.org/) catalog
- **Completion**, **hover**, **document symbols**, **folding**, **go to definition** for anchors,
  **rename**, **document links**, **selection ranges**, **code actions** and **code lenses**
- **Formatting**, including format-on-type

### TOML — powered by [Taplo](https://github.com/tamasfe/taplo)

- **Syntax highlighting** including semantic tokens
- **Validation** against JSON Schema, with schema association through `.taplo.toml` or settings
- **Completion**, **hover**, **document symbols**, **folding**, **rename** and **document links**
- **Formatting**, configurable through `.taplo.toml` or the `langToolkit.taplo` setting

### ANSI — terminal escape sequences

Captured terminal output (`.ans`, `.ansi`) is rendered with its actual colours instead of raw
escape codes.

- **Full SGR coverage**: 16 colours, bright variants, 256-colour (`38;5;n`) and **true colour**
  (`38;2;r;g;b`), plus bold, faint, italic, underline, double underline, strikethrough, overline,
  inverse and conceal
- **Colours follow your theme** — they map to VS Code's `terminal.ansi*` colours, so there is
  nothing to configure
- **Non-SGR sequences are recognised, not mangled** — cursor moves, line clears and the like are
  dimmed rather than rendered as garbage, which is what progress bars and spinners are made of
- **Preview** (`Ctrl+K V` equivalent via the command palette) opens a **real editor** with the
  escape sequences stripped, so search, selection and copy all work normally

To colour other files, associate them with the `ansi` language:

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

That trades away the built-in `log` grammar's timestamp highlighting — worth it only when the file
actually contains escape codes, since otherwise that grammar renders them as noise anyway.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `langToolkit.yaml.enabled` | `true` | Run the YAML language server. Syntax highlighting is unaffected. |
| `langToolkit.toml.enabled` | `true` | Run the TOML language server. Syntax highlighting is unaffected. |
| `langToolkit.taplo` | `{}` | Settings handed to Taplo, in camelCase. See the [Taplo configuration reference](https://taplo.tamasfe.dev/configuration/file.html). |
| `langToolkit.toml.grammarUpdate.enabled` | `true` | Check weekly for a newer TOML grammar in the background. |
| `langToolkit.toml.grammarUpdate.url` | upstream `toml.tmLanguage.json` | Where that grammar comes from. |

YAML schema associations use the same `yaml.schemas` and `yaml.schemaStore.*` keys that
`yaml-language-server` reads directly, so existing configuration keeps working.

## Commands

| Command | What it does |
| --- | --- |
| `Lang Toolkit: Restart Language Servers` | Restarts both servers without reloading the window. |
| `Lang Toolkit: Check for TOML Grammar Updates` | Fetches the grammar now instead of waiting for the weekly check. |
| `Lang Toolkit: Open ANSI Preview` | Opens the current file with escape sequences stripped. |
| `Lang Toolkit: Open ANSI Preview to the Side` | Same, in a side-by-side editor. |

## Network behaviour

Two things reach the network, both disableable:

1. **Schema downloads.** Both language servers fetch JSON Schemas referenced by your files, and
   YAML additionally fetches the SchemaStore catalog. Turn a server off to stop this entirely.
2. **TOML grammar updates.** Once a week, in the background, the extension checks whether the
   upstream TOML TextMate grammar has changed. Downloaded content is rejected unless it parses as
   JSON and declares the `source.toml` scope, and it is written atomically — a bad response can
   never corrupt the bundled grammar. **A grammar update only takes effect after the window is
   reloaded**, because `contributes.grammars` is read when the extension loads. Set
   `langToolkit.toml.grammarUpdate.enabled` to `false` to keep the bundled grammar and make no
   requests for it.

There is no telemetry.

## Size

The extension bundles both servers, so it is larger than a typical language extension:

| Component | Size |
| --- | --- |
| `out/extension.js` (client + YAML server + Taplo glue) | ~1.7 MB |
| `out/taplo.wasm` | ~25 MB (~6.6 MB compressed) |

Taplo publishes its WebAssembly as base64 inlined into a 34 MB JavaScript file. This extension
extracts it into a standalone `.wasm` at build time, which cuts roughly a third off the download —
base64's 4/3 expansion is not something gzip can compress back to the density of the raw binary.

## License

MIT — see [LICENSE.txt](./LICENSE.txt). Bundled third-party components and their licenses are
listed in [NOTICE.md](./NOTICE.md).
