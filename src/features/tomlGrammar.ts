import * as vscode from 'vscode';

import {
  GRAMMAR_UPDATE_INTERVAL_MS,
  isValidTomlGrammar,
  shouldCheckForUpdate,
} from '../shared/grammar';
import { getOutput } from '../shared/output';

const LAST_CHECKED_KEY = 'tomlGrammar.lastCheckedAt';
const ETAG_KEY = 'tomlGrammar.etag';

const GRAMMAR_RELATIVE_PATH = ['syntaxes', 'toml.tmLanguage.json'];

export type UpdateOutcome =
  | { kind: 'disabled' }
  | { kind: 'throttled' }
  | { kind: 'unchanged' }
  | { kind: 'updated' }
  | { kind: 'failed'; reason: string };

function grammarUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, ...GRAMMAR_RELATIVE_PATH);
}

/**
 * 后台更新内置的 TOML 语法文件。
 *
 * 三条硬约束, 都是这个功能能安全存在的前提:
 *
 * 1. **不阻塞。** 调用方永远不 await 它 (手动命令除外), 网络慢或不通都不影响扩展可用性。
 * 2. **不写坏。** 下载内容先过 `isValidTomlGrammar`, 再写临时文件, 最后 rename ——
 *    半个文件或一段 HTML 错误页落到语法路径上会让 TOML 高亮整体失效, 且用户无从察觉。
 * 3. **不即时生效。** `contributes.grammars.path` 是清单里的静态声明, VS Code 在加载扩展时
 *    读取, 运行时替换文件必须重载窗口才生效 —— 这是宿主机制, 无法绕过, 因此只在手动触发时
 *    提示重载, 自动更新一律安静落盘。
 *
 * 扩展目录在部分安装形态下只读 (企业管控, 某些远程场景), 写入失败按普通失败处理并保留旧文件。
 */
export async function updateTomlGrammar(
  context: vscode.ExtensionContext,
  options: { force: boolean },
): Promise<UpdateOutcome> {
  const output = getOutput();
  const config = vscode.workspace.getConfiguration('langToolkit');

  if (!options.force && !config.get<boolean>('toml.grammarUpdate.enabled', true)) {
    return { kind: 'disabled' };
  }

  const lastCheckedAt = context.globalState.get<number>(LAST_CHECKED_KEY);
  if (!options.force && !shouldCheckForUpdate(lastCheckedAt, Date.now(), GRAMMAR_UPDATE_INTERVAL_MS)) {
    return { kind: 'throttled' };
  }

  const url = config.get<string>('toml.grammarUpdate.url', '').trim();
  if (url.length === 0) return { kind: 'failed', reason: 'the update URL is empty' };

  // 无论成功失败都记一次时间戳: 否则上游持续不可达时每次激活都会重试。
  await context.globalState.update(LAST_CHECKED_KEY, Date.now());

  const target = grammarUri(context);
  const temporary = target.with({ path: `${target.path}.tmp` });

  try {
    const headers: Record<string, string> = { accept: 'application/json, text/plain' };
    const etag = context.globalState.get<string>(ETAG_KEY);
    // 手动触发时不带 If-None-Match: 用户点了"检查更新"就应该真的去取一次完整内容,
    // 否则本地文件被改坏后 304 会让人无从修复。
    if (etag && !options.force) headers['if-none-match'] = etag;

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });

    if (response.status === 304) {
      output.debug('TOML grammar is up to date (304).');
      return { kind: 'unchanged' };
    }
    if (!response.ok) {
      const reason = `HTTP ${response.status}`;
      output.warn(`TOML grammar update failed: ${reason}`);
      return { kind: 'failed', reason };
    }

    const text = await response.text();
    if (!isValidTomlGrammar(text)) {
      const reason = 'the downloaded content is not a valid TOML TextMate grammar';
      output.warn(`TOML grammar update rejected: ${reason}`);
      return { kind: 'failed', reason };
    }

    const next = Buffer.from(text, 'utf8');
    const current = await readIfExists(target);
    if (current && current.equals(next)) {
      await rememberEtag(context, response);
      output.debug('TOML grammar is byte-identical to the bundled one.');
      return { kind: 'unchanged' };
    }

    await vscode.workspace.fs.writeFile(temporary, next);
    await vscode.workspace.fs.rename(temporary, target, { overwrite: true });
    await rememberEtag(context, response);

    output.info('TOML grammar updated; reload the window to apply it.');
    return { kind: 'updated' };
  } catch (error) {
    await safeDelete(temporary);
    const reason = error instanceof Error ? error.message : String(error);
    output.warn(`TOML grammar update failed: ${reason}`);
    return { kind: 'failed', reason };
  }
}

async function rememberEtag(context: vscode.ExtensionContext, response: Response): Promise<void> {
  const etag = response.headers.get('etag');
  if (etag) await context.globalState.update(ETAG_KEY, etag);
}

async function readIfExists(uri: vscode.Uri): Promise<Buffer | undefined> {
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

async function safeDelete(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(uri);
  } catch {
    // 临时文件本来就可能不存在, 清理失败不值得让整个流程失败。
  }
}
