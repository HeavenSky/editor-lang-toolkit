# 在 uv 项目中调试 Python

[English](../../docs/python-debugging.md) · **简体中文**

读完本页就能启动、配置 Python 调试器并附加到运行中的进程；前提是项目用 [uv](https://docs.astral.sh/uv/) 管理且本机装有 `uv`，不需要微软的 Python 扩展。

## 调试当前文件

打开 `.py` 文件按 F5。没有 `launch.json` 时，当前文件直接在调试器下运行，可以下断点、单步、看变量、加监视表达式和使用调试控制台，输入输出走集成终端。

调试器以 `uv run --with debugpy python -m debugpy.adapter` 在工作目录下启动。uv 会解析该目录所属的项目环境，项目依赖可以正常 import；`debugpy` 在第一次调试时从 PyPI 拉取，不会加进项目。

## 保存调试配置

通过 **运行 → 添加配置…** 添加配置，有三个 _Python (uv)_ 模板：_当前文件_、_模块_（`python -m`）与 _附加到 debugpy_（英文界面：Current File、Module、Attach to debugpy）。最简单的启动配置：

```jsonc
{
	"name": "Python (uv): Current File",
	"type": "uvpy",
	"request": "launch",
	"program": "${file}",
	"console": "integratedTerminal",
}
```

编辑 `launch.json` 时 IntelliSense 会列出全部属性。会改变行为的几项：

- `cwd` 决定用哪个 uv 项目环境。默认是工作区文件夹，没有打开文件夹时是 `program` 所在目录；monorepo 里应设为项目目录。
- `module` 改为运行 `python -m <module>`，取代 `program`。
- `uvArgs` 追加给 `uv run` 的参数，例如加装一个包用 `["--with", "requests"]`，指定版本用 `["--python", "3.12"]`。
- `python` 指定运行程序的解释器，默认用 `uv run` 解析出的那个。
- `uvPath` 指向 `uv` 可执行文件，按原样使用，不检查文件是否存在。
- `console` 默认 `integratedTerminal`，程序可以从 stdin 读输入。
- `justMyCode`（默认 `true`）单步时跳过标准库和已安装的包。

## 附加到运行中的程序

先以 debugpy 监听模式启动程序，再运行 _附加到 debugpy_ 模板添加的 _Python (uv): Attach_ 配置：

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

## uv 的查找顺序

设置了 `uvPath` 就用它。否则先查 `PATH`，再查默认安装位置：macOS 与 Linux 上是 `~/.local/bin`、`~/.cargo/bin`、`/opt/homebrew/bin`、`/opt/local/bin` 和 `/usr/local/bin`，Windows 上是 `%USERPROFILE%\.local\bin` 和 `%USERPROFILE%\.cargo\bin`。从 Dock 启动的 VS Code 在 macOS 上不一定继承 shell 的 `PATH`，这时就靠后面这些位置找到 uv。

## 不包含的功能

扩展只提供调试器，没有解释器选择、测试资源管理器和 notebook 支持。它可以和微软的 Python Debugger 并存：两者调试类型不同（对方是 `debugpy`），断点共用；没有 `launch.json` 时按 F5 会询问用哪一个。
