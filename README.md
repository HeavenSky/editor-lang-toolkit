# Editor Lang Toolkit

**English** · [简体中文](./zh/README.md)

Schema validation, completion and formatting for YAML and TOML, real terminal colours for ANSI logs, and F5 debugging for uv Python projects, with no language server or CLI to install.

[![VS Marketplace](https://vsmarketplacebadges.dev/version-short/HeavenSky.editor-lang-toolkit.svg?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![Installs](https://vsmarketplacebadges.dev/installs-short/HeavenSky.editor-lang-toolkit.svg)](https://marketplace.visualstudio.com/items?itemName=HeavenSky.editor-lang-toolkit)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.txt)

VS Code ships a full language service for JSON, but only a syntax grammar for YAML and nothing at all for TOML. Extensions that fill the gap often ask you to install a CLI such as `taplo` first. **This one bundles both language servers, so opening a config file is all it takes.** There is no telemetry.

![A YAML file checked against its JSON Schema: "replicas: three" is flagged as "Incorrect type. Expected integer"](media/screenshots/yaml-validation.png)

## Get started

1. Install the extension:

    ```bash
    code --install-extension HeavenSky.editor-lang-toolkit
    ```

2. Open a well-known YAML file, such as a GitHub workflow: mistakes are underlined right away.
3. For any other YAML file, add a schema on the first line, then press `Ctrl+Space` for completions:

    ```yaml
    # yaml-language-server: $schema=./service.schema.json
    ```

## Catch config mistakes as you type

YAML and TOML files are validated against JSON Schema while you edit, and the same schema drives completion and hover. YAML picks the schema from a modeline, an inline `$schema`, the `yaml.schemas` setting or the SchemaStore catalog; TOML reads its associations from `.taplo.toml`. See [Validate YAML and TOML against a schema](docs/schemas.md) for the full rules.

![Completion in a YAML file, with values and descriptions taken from its JSON Schema](media/screenshots/yaml-completion.png)

## Share one TOML config between the editor and CI

The extension reads the same `.taplo.toml` as the `taplo` CLI, so formatting and schema rules match in both places without a second copy. Without that file, the `langToolkit.taplo` setting carries the same options.

![A TOML file with syntax highlighting and a schema error](media/screenshots/toml-validation.png)

## Read terminal logs in their real colours

Files with the `ansi` language (`.ans`, `.ansi`) are shown with their escape codes rendered as colours, from the 16 basic colours to 24-bit true colour. Colours come from your theme's terminal palette, so there is nothing to configure. To colour other files, such as logs:

```jsonc
{ "files.associations": { "*.log": "ansi" } }
```

![An ANSI log rendered in colour, next to a preview with the escape codes removed](media/screenshots/ansi-preview.png)

## Debug a uv project with F5

Press F5 in a `.py` file to debug it with breakpoints, stepping and variables, without the Microsoft Python extensions; you only need `uv` installed. The program runs in the environment `uv run` resolves for your project, and `debugpy` is fetched by uv on the fly, never added to your project. [Debug Python in a uv project](docs/python-debugging.md) covers `launch.json` templates and attaching.

## When not to use it

The Python support is a debugger only: if you want an interpreter picker, a test explorer or notebooks, use the Microsoft Python extension. If you need TOML formatting or validation outside the editor, run the `taplo` CLI against the same `.taplo.toml`; this extension does not ship a command-line tool.

## Learn more

The [guides](docs/README.md) cover schemas, ANSI files, Python debugging, network access and troubleshooting. Commands and settings are listed on the marketplace page's **Feature Contributions** tab. See the [changelog](./CHANGELOG.md) for what changed in each release, and [NOTICE.md](./NOTICE.md) for the upstream projects this extension bundles.

## License

[MIT](./LICENSE.txt)
