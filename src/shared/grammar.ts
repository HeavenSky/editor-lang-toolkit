/**
 * TOML 语法文件的校验与更新节流 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * 语法文件是通过 `contributes.grammars.path` 静态声明的, VS Code 在加载扩展时读取它。
 * 因此后台更新写入的新版本要等下次窗口重载才生效, 且一旦写坏就会让 TOML 高亮整体失效 ——
 * 落盘前必须先通过本模块的校验, 这是唯一的防线。
 */

import { createHash } from 'node:crypto';

/** 语法更新的检查周期: 一周。 */
export const GRAMMAR_UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** 本扩展声明的 TOML scope; 上游换了 scopeName 就不能再当作同一份语法覆盖进来。 */
export const TOML_SCOPE_NAME = 'source.toml';

/**
 * 判断一段文本能否作为 TOML 语法文件落盘。
 *
 * 只认结构上确实是 TextMate 语法且 scope 与清单一致的内容: 上游改名, 返回 404 页面,
 * 代理插了一段 HTML, 都会在这里被拦下, 而不是等用户打开 TOML 文件才发现高亮没了。
 */
export function isValidTomlGrammar(text: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;

  const grammar = parsed as Record<string, unknown>;
  if (grammar['scopeName'] !== TOML_SCOPE_NAME) return false;

  const patterns = grammar['patterns'];
  if (!Array.isArray(patterns) || patterns.length === 0) return false;

  // repository 不是必需的, 但空对象说明内容被截断过。
  const repository = grammar['repository'];
  if (repository !== undefined) {
    if (typeof repository !== 'object' || repository === null || Array.isArray(repository)) {
      return false;
    }
  }
  return true;
}

/**
 * 距上次检查是否已满一个周期。
 *
 * `lastCheckedAt` 为 undefined 表示从未检查过 —— 首次激活即检查一次, 之后按周期节流。
 * 时钟回拨 (now < lastCheckedAt) 时也放行, 否则一次错误的系统时间会永久关掉更新。
 */
export function shouldCheckForUpdate(
  lastCheckedAt: number | undefined,
  now: number,
  intervalMs: number = GRAMMAR_UPDATE_INTERVAL_MS,
): boolean {
  if (typeof lastCheckedAt !== 'number' || !Number.isFinite(lastCheckedAt)) return true;
  if (now < lastCheckedAt) return true;
  return now - lastCheckedAt >= intervalMs;
}

/** 上次成功同步时记下的 ETag, 连同当时磁盘上语法文件内容的摘要。 */
export interface EtagRecord {
  etag: string;
  sha256: string;
}

export function grammarDigest(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 本次请求能否带 If-None-Match, 能则返回要带的 ETag。
 *
 * 语法写在扩展安装目录里, 而 ETag 存在跨版本保留的 globalState: 扩展升级 (或重装) 会把文件
 * 换回自带版本, 旧 ETag 却还在, 上游回 304 后更新就再也不会落盘。因此只有磁盘内容与记下
 * ETag 时的内容一致才带条件头; 读不到文件, 内容变了, 或记录格式不对, 一律完整下载。
 */
export function etagForRequest(record: unknown, diskDigest: string | undefined): string | undefined {
  if (diskDigest === undefined) return undefined;
  if (typeof record !== 'object' || record === null) return undefined;
  const { etag, sha256 } = record as Partial<EtagRecord>;
  if (typeof etag !== 'string' || etag.length === 0 || typeof sha256 !== 'string') return undefined;
  return sha256 === diskDigest ? etag : undefined;
}
