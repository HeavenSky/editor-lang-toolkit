import * as vscode from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import { getOutput } from '../shared/output';

import { TOML_SERVER_FLAG, YAML_SERVER_FLAG } from './serverFlags';

/**
 * 两个服务器都不是独立产物, 而是 fork 本 bundle 自己: `out/extension.js` 带上 `serverFlags`
 * 里的开关就进入对应的 server 分支。这样打包产物只有一个 js (加一个 wasm), 既满足打包门禁的
 * 允许清单, 又让服务器跑在独立进程里 —— 解析与 schema 校验都是 CPU 密集的, 放进扩展宿主会卡界面。
 */
const clients = new Map<string, LanguageClient>();

/** 两个服务器共用的 fork 方式: 传输一律走 Node IPC, 不占用 stdio。 */
function forkedServerOptions(context: vscode.ExtensionContext, flag: string, inspectPort: number): ServerOptions {
  const module = context.asAbsolutePath('out/extension.js');
  return {
    run: { module, args: [flag], transport: TransportKind.ipc },
    debug: {
      module,
      args: [flag],
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', `--inspect=${inspectPort}`] },
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
function createYamlClient(context: vscode.ExtensionContext): LanguageClient {
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'yaml' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{yaml,yml,json}'),
    },
    initializationOptions: {
      // 必须显式给出: 服务器在 initialize 里无条件加载语言包, 读不到就让整个 initialize 失败,
      // 而它的默认路径是相对源码目录算的 (`__dirname/../../../l10n`), 打成 bundle 之后必然失效。
      l10nPath: context.asAbsolutePath('l10n/yaml-language-server'),
    },
    outputChannel: getOutput(),
  };
  return new LanguageClient(
    'langToolkit.yaml',
    'YAML Language Server',
    forkedServerOptions(context, YAML_SERVER_FLAG, 6019),
    clientOptions,
  );
}

/**
 * TOML: 自带 taplo 的 WebAssembly 构建。
 *
 * `configurationSection` 必须显式指定: taplo 的默认值是 `evenBetterToml` (证据:
 * `crates/taplo-lsp/src/config.rs` 的 `default_configuration_section`), 沿用它等于让本扩展
 * 去读另一个扩展的设置节。改成自己的节后两者可以共存, 互不干扰。
 */
function createTomlClient(context: vscode.ExtensionContext): LanguageClient {
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'toml' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/{*.toml,.taplo.toml}'),
    },
    initializationOptions: {
      configurationSection: 'langToolkit.taplo',
      cachePath: context.globalStorageUri.fsPath,
    },
    outputChannel: getOutput(),
  };
  return new LanguageClient(
    'langToolkit.toml',
    'Taplo Language Server',
    forkedServerOptions(context, TOML_SERVER_FLAG, 6020),
    clientOptions,
  );
}

const FACTORIES: Record<string, { setting: string; create: (context: vscode.ExtensionContext) => LanguageClient }> = {
  yaml: { setting: 'yaml.enabled', create: createYamlClient },
  toml: { setting: 'toml.enabled', create: createTomlClient },
};

/**
 * 启动全部已启用的语言服务器。
 *
 * 单个服务器起不来只影响它自己: 语法高亮由清单的 `contributes.grammars` 与内置的 YAML 语法
 * 声明式提供, 与语言服务器无关, 因此最坏情况是退回到"只有高亮", 而不是整个扩展失效。
 */
export async function startServers(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('langToolkit');
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
    const client = factory.create(context);
    clients.set(id, client);
    pending.push(
      client.start().catch((error: unknown) => {
        output.error(`Failed to start the ${id.toUpperCase()} language server: ${String(error)}`);
        clients.delete(id);
      }),
    );
  }
  await Promise.allSettled(pending);
}

export async function stopServers(): Promise<void> {
  const running = [...clients.values()];
  clients.clear();
  await Promise.allSettled(running.map((client) => client.stop()));
}

export async function restartServers(context: vscode.ExtensionContext): Promise<void> {
  await stopServers();
  await startServers(context);
}
