# Control network access

**English** · [简体中文](../zh/docs/network.md)

This page lists every network request the extension can cause and how to turn each one off, for offline machines or strict networks. **The extension sends no telemetry and nothing about you or your files.**

## What reaches the network

| Request                                                       | When                                                     | How to avoid it                                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON Schemas your files point to, and the SchemaStore catalog | While you edit a YAML or TOML file that uses them        | Use local schema paths. Turn the catalog off with `yaml.schemaStore.enable: false` for YAML and `"langToolkit.taplo": { "schema": { "catalogs": [] } }` for TOML, or turn a server off with `langToolkit.yaml.enabled` / `langToolkit.toml.enabled` |
| The upstream TOML TextMate grammar                            | At most once a week, in the background                   | Set `langToolkit.toml.grammarUpdate.enabled` to `false`                                                                                                                                                                                             |
| `debugpy` from PyPI, fetched by uv                            | The first time you debug Python; uv caches it afterwards | Do not start a Python debug session, or run `uv run --with debugpy python -c "import debugpy"` once while online so uv caches it                                                                                                                    |

## How grammar downloads are checked

A downloaded grammar is kept only if it parses as JSON, declares the `source.toml` scope and has grammar rules. It is written to a temporary file and then renamed into place, so a failed or partial download cannot break TOML highlighting. A failed check is retried a week later, not on every start.

If you point `langToolkit.toml.grammarUpdate.url` at a mirror, the same checks apply. When the extension folder is read-only, as in some managed or remote setups, the update fails and the bundled grammar stays in use.
