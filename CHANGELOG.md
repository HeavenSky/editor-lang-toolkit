# Changelog

## v0.0.1 2026-08-07

Initial release.

**YAML** — bundles [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) 1.24.0:

- JSON Schema validation (draft-04 / 07 / 2019-09 / 2020-12), unused anchor detection, flow-style rules, mapping key order
- Schema discovery: modelines, an inline `$schema` property, the `yaml.schemas` setting, and the SchemaStore catalog
- Completion, hover, document symbols, folding, go-to-definition for anchors, rename, document links, selection ranges, code actions, code lenses
- Formatting and format-on-type

**TOML** — bundles a WebAssembly build of [Taplo](https://github.com/tamasfe/taplo) 0.7.0:

- Syntax highlighting (TextMate grammar from upstream) with semantic tokens
- JSON Schema validation, completion, hover, document symbols, folding, rename, document links, formatting
- Configured through `.taplo.toml` — the same file the CLI reads — or the `langToolkit.taplo` setting

**ANSI** — parser ported from [vscode-ansi](https://github.com/iliazeus/vscode-ansi):

- Full SGR coverage: 16 colours and their bright variants, 256-colour (`38;5;n`), true colour (`38;2;r;g;b`), plus bold, faint, italic, underline, double underline, strikethrough, overline, inverse and conceal
- Colours map to the `terminal.ansi*` theme palette, so there are no settings to keep in sync
- Non-SGR CSI sequences (cursor moves, line clears) are recognised and dimmed rather than rendered as garbage
- Preview is a virtual document rather than a webview, so search, selection, copy and side-by-side scrolling are native editor behaviour
- Two additions over upstream: 300 ms debounce while typing, and an LRU cap of 512 decoration types so true-colour output cannot allocate host resources without bound

**Other**:

- Both language servers are bundled; the extension depends on **no external CLI tool**. `scripts/check-extra.mjs` turns that promise into a pre-publish gate, checking both the source and the manifest.
- The TOML grammar is checked for updates weekly in the background. Downloaded content must parse as JSON and declare the `source.toml` scope before it is written atomically; an update takes effect after a window reload. Disable with `langToolkit.toml.grammarUpdate.enabled`.
- The icon is built from three parts, one recognisable trait per supported language: `[ ]` with a swatch inside is TOML's `[table]`, the indented rows are key-value structure, and the `>` prompt with multi-coloured rows is terminal output with ANSI colouring. The foreground deliberately avoids a single colour — colouring is what this extension does, so the icon says it with several colours per row.
- UI available in English and 简体中文, following the VS Code display language.
- No telemetry.
- Taplo's WebAssembly is extracted from upstream's inlined base64 into a standalone `out/taplo.wasm` at build time, cutting the compressed size from roughly 9.9 MB to 6.6 MB.
