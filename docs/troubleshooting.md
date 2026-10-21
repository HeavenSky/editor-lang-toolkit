# Troubleshooting and known limitations

**English** · [简体中文](../zh/docs/troubleshooting.md)

This page matches messages and behaviour you may see to their cause and fix. Logs from the extension and both language servers are in the **Output** panel under **Editor Lang Toolkit**.

## Python debugging

**`Python debugging needs uv, which was not found. Install uv or set "uvPath" in the launch configuration.`**
Cause: `uv` is neither on the `PATH` VS Code inherited nor in a default install location.
Fix: run `which uv` (macOS, Linux) or `where uv` (Windows) in a terminal and put the result in `uvPath` in your launch configuration.

**F5 asks which debugger to use.**
Cause: the Microsoft Python Debugger is also installed, and both declare Python support.
Fix: pick _Python (uv)_, or save a `launch.json` configuration with `"type": "uvpy"` so F5 no longer asks.

**`ModuleNotFoundError` for a package that is in your project.**
Cause: the working directory is not inside the uv project, so `uv run` resolved a different environment. This happens when the workspace folder is above the project, for example in a monorepo.
Fix: set `cwd` in the launch configuration to the project directory.

## YAML and TOML

**No errors or completions in a YAML or TOML file.**
Cause: the file has no schema, or the server is turned off.
Fix: attach a schema as shown in [Validate YAML and TOML against a schema](schemas.md), check `langToolkit.yaml.enabled` and `langToolkit.toml.enabled`, then run **Lang Toolkit: Restart Language Servers**.

**`TOML grammar updated. Reload the window to apply it.`**
Cause: VS Code reads extension grammars only when the window loads.
Fix: click **Reload Window**, or keep working; the new grammar applies after the next reload.

**`Failed to update the TOML grammar: HTTP 404`, or another reason after the colon.**
Cause: the grammar URL is unreachable, the response was not a valid TOML grammar, or the extension folder is read-only.
Fix: check `langToolkit.toml.grammarUpdate.url` and your network; the bundled grammar keeps working meanwhile. See [Control network access](network.md).

## ANSI files

**Escape codes such as `[31m` show up as text.**
Cause: the file's language is not `ansi`.
Fix: add a `files.associations` entry, or switch the language as shown in [View ANSI-coloured files](ansi.md#colour-a-file).

## Known limitations

- A new TOML grammar applies only after a window reload; extension grammars are read at load time, and the extension cannot work around that.
- ANSI colouring is tied to the `ansi` language id. There is no pattern-based opt-in, because that would require activating the extension in every window.
- True-colour output uses one decoration type per style combination. They are capped at 512, and the least recently used are dropped first. Types still on screen are kept, so if the visible ANSI editors need more than 512 combinations at once, the cache grows until you close them.
- Python support covers the debugger only; there is no interpreter picker, test explorer or notebook support.
