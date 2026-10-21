# Validate YAML and TOML against a schema

**English** · [简体中文](../zh/docs/schemas.md)

This page shows how to attach a JSON Schema to YAML and TOML files and how to tune validation and formatting; you only need the extension installed. For a first run, see [Get started](../README.md#get-started).

## How the servers start

The YAML and TOML language servers start the first time you open a file of that language, so ANSI files and Python debugging never launch them. Both servers are bundled and run in their own processes.

- TOML covers `*.toml`, `Cargo.lock` and `uv.lock`.
- Diagnostics are labelled `YAML` or `TOML` in the Problems panel.
- `langToolkit.yaml.enabled` and `langToolkit.toml.enabled` turn a server off; changing them restarts the servers, and syntax highlighting stays on.
- **Lang Toolkit: Restart Language Servers** restarts both without reloading the window.

## Attach a schema to a YAML file

YAML files are matched to a schema in this order; the first match wins:

1. A modeline on the first line: `# yaml-language-server: $schema=<url or relative path>`
2. An inline `$schema` property in the document
3. The `yaml.schemas` setting
4. The [SchemaStore](https://www.schemastore.org/) catalog, matched by filename

The YAML server is [yaml-language-server](https://github.com/redhat-developer/yaml-language-server) and reads the standard `yaml.*` settings directly, so an existing `yaml.schemas` or `yaml.schemaStore.*` configuration works unchanged:

```jsonc
{ "yaml.schemas": { "./schemas/service.schema.json": "deploy/*.yaml" } }
```

Validation supports JSON Schema drafts 04, 07, 2019-09 and 2020-12, including Kubernetes CRD schemas. It also reports unused anchors, and can enforce flow style (`yaml.style.flowMapping`, `yaml.style.flowSequence`) and mapping key order (`yaml.keyOrdering`).

## Format YAML

YAML formatting is done by Prettier, and the `yaml.format.*` settings are Prettier options passed through. If your CI already runs Prettier, the editor and CI produce the same output.

## Configure TOML with .taplo.toml

The TOML server is a WebAssembly build of [Taplo](https://github.com/tamasfe/taplo). It looks for `.taplo.toml` (then `taplo.toml`) up the directory tree, the same file the `taplo` CLI reads, and uses it for schema associations and formatter options. See the [Taplo configuration reference](https://taplo.tamasfe.dev/configuration/file.html) for the file format.

Without a config file, put the same options in the `langToolkit.taplo` setting, with keys in camelCase. Rules defined in `.taplo.toml` take precedence. Taplo matches TOML files against the SchemaStore catalog by default; this example spells the catalog out and sets two formatter options:

```jsonc
{
	"langToolkit.taplo": {
		"schema": {
			"enabled": true,
			"catalogs": ["https://www.schemastore.org/api/json/catalog.json"],
		},
		"formatter": { "alignEntries": false, "indentTables": false },
	},
}
```

## Keep the TOML grammar current

TOML syntax highlighting uses Taplo's TextMate grammar. The extension checks for a newer copy once a week in the background; **a downloaded grammar takes effect only after you reload the window**. Run **Lang Toolkit: Check for TOML Grammar Updates** to check now, or turn the check off with `langToolkit.toml.grammarUpdate.enabled`. `langToolkit.toml.grammarUpdate.url` sets where the grammar is fetched from; see [Control network access](network.md) for how downloads are checked.
