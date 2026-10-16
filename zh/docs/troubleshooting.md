# 故障排查与已知限制

[English](../../docs/troubleshooting.md) · **简体中文**

本页按看到的提示或现象查原因和解决办法。扩展和两个语言服务器的日志都在 **输出** 面板的 **Editor Lang Toolkit** 频道里。

## Python 调试

**`Python 调试需要 uv, 但未找到. 请安装 uv, 或在调试配置中设置 "uvPath".`**（英文界面：`Python debugging needs uv, which was not found. Install uv or set "uvPath" in the launch configuration.`）
原因：VS Code 继承的 `PATH` 和默认安装位置里都没有 `uv`。
解决：在终端运行 `which uv`（macOS、Linux）或 `where uv`（Windows），把结果填进调试配置的 `uvPath`。

**按 F5 时询问用哪个调试器。**
原因：同时装了微软的 Python Debugger，两者都声明支持 Python。
解决：选 *Python (uv)*，或保存一份 `"type": "uvpy"` 的 `launch.json` 配置，之后 F5 不再询问。

**项目里明明有的包报 `ModuleNotFoundError`。**
原因：工作目录不在 uv 项目内，`uv run` 解析到了别的环境。工作区文件夹在项目上层时（例如 monorepo）会这样。
解决：把调试配置的 `cwd` 设为项目目录。

## YAML 与 TOML

**YAML 或 TOML 文件没有报错也没有补全。**
原因：文件没有关联 schema，或服务器被关掉了。
解决：按[为 YAML 与 TOML 指定 schema](schemas.md)关联 schema，检查 `langToolkit.yaml.enabled` 与 `langToolkit.toml.enabled`，再运行 **Lang Toolkit: 重启语言服务器**（英文界面：Restart Language Servers）。

**`TOML 语法已更新, 重载窗口后生效.`**（英文界面：`TOML grammar updated. Reload the window to apply it.`）
原因：VS Code 只在窗口加载时读取扩展的语法文件。
解决：点 **重载窗口**，或继续工作，下次重载后生效。

**`更新 TOML 语法失败: HTTP 404`，或冒号后是其他原因。**（英文界面：`Failed to update the TOML grammar: …`）
原因：语法地址无法访问、返回内容不是有效的 TOML 语法，或扩展目录只读。
解决：检查 `langToolkit.toml.grammarUpdate.url` 和网络；在此期间内置语法照常工作。参见[控制网络访问](network.md)。

## ANSI 文件

**`[31m` 这样的转义码显示成了文字。**
原因：文件的语言不是 `ansi`。
解决：加一条 `files.associations`，或按[查看 ANSI 着色文件](ansi.md#为文件着色)切换语言。

## 已知限制

- 新的 TOML 语法要重载窗口才生效：扩展语法在加载时读取，扩展无法绕过。
- ANSI 着色绑定在 `ansi` 语言上。没有按文件名模式自动启用的选项，因为那需要每个窗口启动时都激活扩展。
- 真彩色输出的每种样式组合占用一个装饰类型。上限 512 个，最久没用的先淘汰。仍在屏幕上的不会被淘汰，所以可见的 ANSI 编辑器同时需要超过 512 种组合时，缓存会继续增长，直到你关掉这些编辑器。
- Python 部分只有调试器，没有解释器选择、测试资源管理器和 notebook 支持。
