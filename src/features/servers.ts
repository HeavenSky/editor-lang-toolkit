import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
import type { LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";

import { rewriteTaploSource } from "../shared/diagnosticSource";
import { getOutput } from "../shared/output";

import { TOML_SERVER_FLAG, YAML_SERVER_FLAG } from "./serverFlags";
import { withYamlFormatDefault } from "./yamlFormatSettings";

/**
 * 两个服务器都不是独立产物, 而是 fork 本 bundle 自己: `out/extension.js` 带上 `serverFlags`
 * 里的开关就进入对应的 server 分支。这样打包产物只有一个 js (加一个 wasm), 既满足打包门禁的
 * 允许清单, 又让服务器跑在独立进程里 —— 解析与 schema 校验都是 CPU 密集的, 放进扩展宿主会卡界面。
 */
const clients = new Map<string, LanguageClient>();

/**
 * 文件监听器与客户端一一对应, 由本模块持有所有权: `FileSystemWatcherFeature` 只管理自己的
 * 事件订阅, `clear()` 不会 dispose 外部传入的 watcher 本体, 不显式释放就会随每次重启泄漏。
 */
const watchers = new Map<string, vscode.FileSystemWatcher>();

/**
 * 启动, 停止与重启串行排队: 上一个阶段完全结束前, 下一个不开跑。
 *
 * `vscode-languageclient` 对处于 Starting 状态的客户端会拒绝 `stop()`; 若启动还在进行就执行
 * 停止或重启, `stopServers` 先清空 `clients` 再 stop 会漏掉尚未登记完成的事务 —— 结果是旧
 * 客户端继续启动却再也无人能停, 同一语言出现两个服务器实例。排队是唯一的解, 因为每个阶段
 * 内部都已有逐客户端的错误隔离, 串起来不会放大故障面。
 */
let lifecycle: Promise<void> = Promise.resolve();

function enqueueLifecycle(task: () => Promise<void>): Promise<void> {
	const run = lifecycle.then(task, task);
	// 生命周期链条永不 reject: task 内部已逐项兜底, 这里再落地一次防串联断裂。
	lifecycle = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

/** 两个服务器共用的 fork 方式: 传输一律走 Node IPC, 不占用 stdio。 */
function forkedServerOptions(
	context: vscode.ExtensionContext,
	flag: string,
	inspectPort: number
): ServerOptions {
	const serverModule = context.asAbsolutePath("out/extension.js");
	return {
		run: { module: serverModule, args: [flag], transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			args: [flag],
			transport: TransportKind.ipc,
			options: { execArgv: ["--nolazy", `--inspect=${inspectPort}`] },
		},
	};
}

/**
 * YAML: 自带 `yaml-language-server`。
 *
 * 不需要在客户端实现任何 schema 桥接 —— yaml-language-server 只有在收到
 * `yaml/registerContentRequest` 通知后才把取 schema 的活转交客户端, 默认情况下它自己走 HTTP
 * 与文件系统 (`useVSCodeContentRequest` 默认 false)。少一层桥接就少一处能出错的地方。
 */
function createYamlClient(context: vscode.ExtensionContext): {
	client: LanguageClient;
	watcher: vscode.FileSystemWatcher;
} {
	const watcher = vscode.workspace.createFileSystemWatcher("**/*.{yaml,yml,json}");
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: "yaml" }],
		synchronize: { fileEvents: watcher },
		initializationOptions: {
			// 必须显式给出: 服务器在 initialize 里无条件加载语言包, 读不到就让整个 initialize 失败,
			// 而它的默认路径是相对源码目录算的 (`__dirname/../../../l10n`), 打成 bundle 之后必然失效。
			l10nPath: context.asAbsolutePath("l10n/yaml-language-server"),
		},
		outputChannel: getOutput(),
		middleware: {
			workspace: {
				// 给 `yaml.format.enable` 补默认值, 见 `yamlFormatSettings.ts`; 不补则单独安装本扩展
				// 时没有任何配置源提供真值, 动态注册的格式化能力永远不会出现。
				configuration: async (params, token, next) => {
					const result = await next(params, token);
					if (!Array.isArray(result)) return result;
					return result.map((value, index) =>
						withYamlFormatDefault(params.items[index]?.section, value)
					);
				},
			},
		},
	};
	const client = new LanguageClient(
		"langToolkit.yaml",
		"YAML Language Server",
		forkedServerOptions(context, YAML_SERVER_FLAG, 6019),
		clientOptions
	);
	return { client, watcher };
}

/**
 * TOML: 自带 taplo 的 WebAssembly 构建。
 *
 * `configurationSection` 必须显式指定: taplo 的默认值是 `evenBetterToml` (证据:
 * `crates/taplo-lsp/src/config.rs` 的 `default_configuration_section`), 沿用它等于让本扩展
 * 去读另一个扩展的设置节。改成自己的节后两者可以共存, 互不干扰。
 */
function createTomlClient(context: vscode.ExtensionContext): {
	client: LanguageClient;
	watcher: vscode.FileSystemWatcher;
} {
	const watcher = vscode.workspace.createFileSystemWatcher("**/{*.toml,.taplo.toml}");
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: "toml" }],
		synchronize: { fileEvents: watcher },
		initializationOptions: {
			configurationSection: "langToolkit.taplo",
			cachePath: context.globalStorageUri.fsPath,
		},
		outputChannel: getOutput(),
		middleware: {
			// 来源写死在 wasm 里, 只能在客户端改写, 见 `rewriteTaploSource`。
			handleDiagnostics: (uri, diagnostics, next) =>
				next(uri, rewriteTaploSource(diagnostics)),
		},
	};
	const client = new LanguageClient(
		"langToolkit.toml",
		"Taplo Language Server",
		forkedServerOptions(context, TOML_SERVER_FLAG, 6020),
		clientOptions
	);
	return { client, watcher };
}

const FACTORIES: Record<
	string,
	{
		setting: string;
		create: (context: vscode.ExtensionContext) => {
			client: LanguageClient;
			watcher: vscode.FileSystemWatcher;
		};
	}
> = {
	yaml: { setting: "yaml.enabled", create: createYamlClient },
	toml: { setting: "toml.enabled", create: createTomlClient },
};

/**
 * 启动全部已启用的语言服务器。
 *
 * 单个服务器起不来只影响它自己: 语法高亮由清单的 `contributes.grammars` 与内置的 YAML 语法
 * 声明式提供, 与语言服务器无关, 因此最坏情况是退回到"只有高亮", 而不是整个扩展失效。
 */
export function startServers(context: vscode.ExtensionContext): Promise<void> {
	return enqueueLifecycle(() => startServersNow(context));
}

async function startServersNow(context: vscode.ExtensionContext): Promise<void> {
	const config = vscode.workspace.getConfiguration("langToolkit");
	const output = getOutput();

	// taplo 把 schema 缓存写进这里, 目录不存在时它只会静默失败, 所以先建好。
	try {
		await vscode.workspace.fs.createDirectory(context.globalStorageUri);
	} catch (error) {
		output.warn(`Failed to create the cache directory: ${String(error)}`);
	}

	const pending: Promise<void>[] = [];
	for (const [id, factory] of Object.entries(FACTORIES)) {
		if (!config.get<boolean>(factory.setting, true) || clients.has(id)) continue;
		const { client, watcher } = factory.create(context);
		clients.set(id, client);
		watchers.set(id, watcher);
		pending.push(
			client.start().catch((error: unknown) => {
				output.error(
					`Failed to start the ${id.toUpperCase()} language server: ${String(error)}`
				);
				clients.delete(id);
				watcher.dispose();
				watchers.delete(id);
			})
		);
	}
	await Promise.allSettled(pending);
}

export function stopServers(): Promise<void> {
	return enqueueLifecycle(stopServersNow);
}

async function stopServersNow(): Promise<void> {
	const running = [...clients.entries()];
	clients.clear();
	const output = getOutput();
	await Promise.allSettled(
		running.map(async ([id, client]) => {
			try {
				await client.stop();
			} catch (error) {
				// 停止失败不阻断其余实例的停止, 也不再留下任何 owned 资源: 客户端已脱管,
				// 进程若还活着由宿主退出兜底, 但 watcher 必须在这里释放。
				output.warn(
					`Failed to stop the ${id.toUpperCase()} language server: ${String(error)}`
				);
			} finally {
				watchers.get(id)?.dispose();
				watchers.delete(id);
			}
		})
	);
}

export function restartServers(context: vscode.ExtensionContext): Promise<void> {
	return enqueueLifecycle(async () => {
		await stopServersNow();
		await startServersNow(context);
	});
}
