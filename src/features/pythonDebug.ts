import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";

import * as vscode from "vscode";

import { findUv } from "../shared/uv";

export const PYTHON_DEBUG_TYPE = "uvpy";

/**
 * Python 调试: 用 `uv run --with debugpy` 拉起 debugpy 的 DAP adapter, 不依赖 ms-python 扩展。
 *
 * 面向已经用 uv 管理的 Python 项目: 复用项目自己的 uv 与解释器, 不要求为本插件另装任何东西,
 * 其余语言功能仍然自包含。adapter 进程由宿主按 `DebugAdapterExecutable` 启动, 扩展自己不
 * spawn 任何东西 (`scripts/check-extra.mjs` 的自包含门禁照常生效)。
 *
 * adapter 跑在 `uv run` 为 `cwd` 解析出的项目环境里; 调试配置不给 `python` 时 debugpy 用 adapter
 * 自身的解释器启动程序, 所以项目依赖可以直接 import, debugpy 也不需要装进项目。
 */
export function registerPythonDebug(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.debug.registerDebugConfigurationProvider(PYTHON_DEBUG_TYPE, {
			resolveDebugConfiguration(folder, config) {
				// 没有 launch.json 时按 F5: 配置是空的, 直接调试当前 Python 文件。
				if (!config.type && !config.request && !config.name) {
					const editor = vscode.window.activeTextEditor;
					if (editor?.document.languageId !== "python") return undefined;
					Object.assign(config, {
						type: PYTHON_DEBUG_TYPE,
						request: "launch",
						name: "Python (uv): Current File",
						program: editor.document.fileName,
					});
				}
				if (config.request === "launch") {
					// debugpy 自己的默认是 internalConsole, 那里不能交互输入; 对齐多数人的预期改成终端。
					config.console ??= "integratedTerminal";
					config.cwd ??=
						folder?.uri.fsPath ??
						(config.program ? dirname(config.program) : undefined);
				}
				return config;
			},
		}),
		vscode.debug.registerDebugAdapterDescriptorFactory(PYTHON_DEBUG_TYPE, {
			createDebugAdapterDescriptor(session) {
				const config = session.configuration;
				const uv = findUv({
					configured: config.uvPath,
					path: process.env.PATH,
					home: homedir(),
					platform: process.platform,
					exists: existsSync,
				});
				if (!uv) {
					// 抛出的错误由宿主弹窗展示; 不抛的话用户只会看到 `spawn uv ENOENT`。
					throw new Error(
						vscode.l10n.t(
							'Python debugging needs uv, which was not found. Install uv or set "uvPath" in the launch configuration.'
						)
					);
				}
				const args = [
					"run",
					...(config.uvArgs ?? []),
					"--with",
					"debugpy",
					"python",
					"-m",
					"debugpy.adapter",
				];
				return new vscode.DebugAdapterExecutable(uv, args, {
					cwd: config.cwd ?? session.workspaceFolder?.uri.fsPath,
				});
			},
		})
	);
}
