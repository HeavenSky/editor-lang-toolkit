import * as vscode from "vscode";

import { getOutput } from "../shared/output";

import { registerAnsi } from "./ansi";
import { registerPythonDebug } from "./pythonDebug";
import { restartServers, startServers } from "./servers";
import { updateTomlGrammar } from "./tomlGrammar";

/** 改动这些设置需要重建客户端, 光靠 `workspace/didChangeConfiguration` 传不下去。 */
const RESTART_ON_CHANGE = ["langToolkit.yaml.enabled", "langToolkit.toml.enabled"];

/** 由语言服务器服务的语言; 只为 ANSI 或 Python 调试激活时不该启动服务器。 */
const SERVER_LANGUAGES = new Set(["yaml", "toml"]);

/** 已打开 YAML/TOML 文件就立即启动服务器, 否则等第一次打开时再启动。 */
async function startServersWhenNeeded(context: vscode.ExtensionContext): Promise<void> {
	if (
		vscode.workspace.textDocuments.some(document => SERVER_LANGUAGES.has(document.languageId))
	) {
		await startServers(context);
		return;
	}
	const waiting = vscode.workspace.onDidOpenTextDocument(document => {
		if (!SERVER_LANGUAGES.has(document.languageId)) return;
		waiting.dispose();
		void startServers(context);
	});
	context.subscriptions.push(waiting);
}

export async function activateExtension(context: vscode.ExtensionContext): Promise<void> {
	const output = getOutput();
	context.subscriptions.push(output);

	context.subscriptions.push(
		vscode.commands.registerCommand("langToolkit.restartServers", async () => {
			await restartServers(context);
			void vscode.window.showInformationMessage(vscode.l10n.t("Language servers restarted."));
		}),
		vscode.commands.registerCommand("langToolkit.updateTomlGrammar", async () => {
			const outcome = await updateTomlGrammar(context, { force: true });
			if (outcome.kind === "updated") {
				const reload = vscode.l10n.t("Reload Window");
				const picked = await vscode.window.showInformationMessage(
					vscode.l10n.t("TOML grammar updated. Reload the window to apply it."),
					reload
				);
				if (picked === reload) {
					await vscode.commands.executeCommand("workbench.action.reloadWindow");
				}
			} else if (outcome.kind === "failed") {
				void vscode.window.showWarningMessage(
					vscode.l10n.t("Failed to update the TOML grammar: {0}", outcome.reason)
				);
			} else {
				void vscode.window.showInformationMessage(
					vscode.l10n.t("The TOML grammar is already up to date.")
				);
			}
		}),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (RESTART_ON_CHANGE.some(section => event.affectsConfiguration(section))) {
				void restartServers(context);
			}
		})
	);

	// ANSI 着色不走语言服务器, 纯装饰; 放在启动服务器之前注册, 让它不受服务器启动耗时影响。
	registerAnsi(context);
	registerPythonDebug(context);

	await startServersWhenNeeded(context);

	// 刻意不 await: 语法更新是纯后台行为, 网络慢或不通都不该拖慢激活。落盘的新语法要等下次
	// 窗口重载才生效 (清单里的 grammar 路径是静态声明), 所以这里也没有必要提示用户。
	void updateTomlGrammar(context, { force: false }).then(outcome => {
		output.debug(`TOML grammar check: ${outcome.kind}`);
	});
}
