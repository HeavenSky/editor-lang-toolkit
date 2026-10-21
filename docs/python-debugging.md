# Debug Python in a uv project

**English** · [简体中文](../zh/docs/python-debugging.md)

This page shows how to launch, configure and attach the Python debugger; you need a project managed with [uv](https://docs.astral.sh/uv/) and `uv` installed. The Microsoft Python extensions are not required.

## Debug the current file

Open a `.py` file and press F5. Without a `launch.json`, the current file runs under the debugger with breakpoints, stepping, variables, watch expressions and the debug console. Output and input go to the integrated terminal.

The debugger starts as `uv run --with debugpy python -m debugpy.adapter` in the working directory. uv resolves that directory's project environment, so your dependencies import normally, and fetches `debugpy` from PyPI the first time without adding it to your project.

## Save a launch configuration

Add a configuration from **Run → Add Configuration…**, which offers three _Python (uv)_ templates: _Current File_, _Module_ (`python -m`) and _Attach to debugpy_. A minimal launch configuration:

```jsonc
{
	"name": "Python (uv): Current File",
	"type": "uvpy",
	"request": "launch",
	"program": "${file}",
	"console": "integratedTerminal",
}
```

The full attribute list appears in IntelliSense while you edit `launch.json`. The ones that change behaviour:

- `cwd` decides which uv project environment is used. It defaults to the workspace folder, or to the directory of `program` when no folder is open; set it to the project directory in a monorepo.
- `module` runs `python -m <module>` instead of `program`.
- `uvArgs` adds arguments to `uv run`, for example `["--with", "requests"]` for an extra package or `["--python", "3.12"]` for a specific version.
- `python` overrides the interpreter that runs the program; by default it is the one `uv run` resolves.
- `uvPath` points at the `uv` executable. It is used as given, without checking that the file exists.
- `console` defaults to `integratedTerminal`, so the program can read from stdin.
- `justMyCode` (default `true`) skips the standard library and installed packages while stepping.

## Attach to a running program

Start your program with debugpy listening, then run the _Python (uv): Attach_ configuration that the _Attach to debugpy_ template adds:

```bash
uv run --with debugpy python -m debugpy --listen 5678 --wait-for-client main.py
```

```jsonc
{
	"name": "Python (uv): Attach",
	"type": "uvpy",
	"request": "attach",
	"connect": { "host": "127.0.0.1", "port": 5678 },
}
```

## How uv is found

`uvPath` wins when set. Otherwise the extension searches `PATH`, then the default install locations: `~/.local/bin`, `~/.cargo/bin`, `/opt/homebrew/bin`, `/opt/local/bin` and `/usr/local/bin` on macOS and Linux, and `%USERPROFILE%\.local\bin` and `%USERPROFILE%\.cargo\bin` on Windows. The fallback matters on macOS, where VS Code started from the Dock may not inherit your shell's `PATH`.

## What is not included

The extension provides the debugger only: there is no interpreter picker, test explorer or notebook support. It works next to the Microsoft Python Debugger, which uses a different debug type (`debugpy`); both share breakpoints, and F5 without a `launch.json` asks which one to use.
