import { describe, expect, it } from 'vitest';

import {
  etagForRequest,
  GRAMMAR_UPDATE_INTERVAL_MS,
  grammarDigest,
  isValidTomlGrammar,
  shouldCheckForUpdate,
} from '../src/shared/grammar';

/** 最小的合法语法; 各用例在它基础上改一处。 */
const valid = JSON.stringify({
  scopeName: 'source.toml',
  patterns: [{ include: '#comment' }],
  repository: { comment: { match: '#.*' } },
});

describe('isValidTomlGrammar', () => {
  it('接受合法语法', () => {
    expect(isValidTomlGrammar(valid)).toBe(true);
  });

  it('repository 可以缺省', () => {
    expect(isValidTomlGrammar(JSON.stringify({ scopeName: 'source.toml', patterns: [{}] }))).toBe(true);
  });

  it('拒绝解析不了的内容', () => {
    // 代理插进来的错误页, 或者被截断的响应 —— 都长这样。
    expect(isValidTomlGrammar('<!DOCTYPE html><html>404</html>')).toBe(false);
    expect(isValidTomlGrammar('')).toBe(false);
    expect(isValidTomlGrammar('{"scopeName":"source.toml","patterns":[')).toBe(false);
  });

  it('拒绝 scope 不匹配的语法', () => {
    // 清单里声明的是 source.toml, 换了 scope 的语法覆盖进来只会让高亮整体失效。
    const other = JSON.stringify({ scopeName: 'source.yaml', patterns: [{}] });
    expect(isValidTomlGrammar(other)).toBe(false);
  });

  it('拒绝没有 patterns 的语法', () => {
    expect(isValidTomlGrammar(JSON.stringify({ scopeName: 'source.toml' }))).toBe(false);
    expect(isValidTomlGrammar(JSON.stringify({ scopeName: 'source.toml', patterns: [] }))).toBe(false);
  });

  it('拒绝 repository 类型不对的语法', () => {
    const broken = JSON.stringify({ scopeName: 'source.toml', patterns: [{}], repository: [] });
    expect(isValidTomlGrammar(broken)).toBe(false);
  });

  it('拒绝顶层不是对象的 JSON', () => {
    expect(isValidTomlGrammar('[]')).toBe(false);
    expect(isValidTomlGrammar('null')).toBe(false);
    expect(isValidTomlGrammar('"source.toml"')).toBe(false);
  });
});

describe('shouldCheckForUpdate', () => {
  const now = 1_800_000_000_000;

  it('从未检查过时放行', () => {
    expect(shouldCheckForUpdate(undefined, now)).toBe(true);
  });

  it('未满一个周期时不放行', () => {
    expect(shouldCheckForUpdate(now - GRAMMAR_UPDATE_INTERVAL_MS + 1, now)).toBe(false);
  });

  it('刚好满一个周期时放行', () => {
    expect(shouldCheckForUpdate(now - GRAMMAR_UPDATE_INTERVAL_MS, now)).toBe(true);
  });

  it('时钟回拨时放行', () => {
    // 否则一次错误的系统时间会把更新永久关掉。
    expect(shouldCheckForUpdate(now + GRAMMAR_UPDATE_INTERVAL_MS * 10, now)).toBe(true);
  });

  it('时间戳损坏时按从未检查处理', () => {
    expect(shouldCheckForUpdate(Number.NaN, now)).toBe(true);
    expect(shouldCheckForUpdate(Number.POSITIVE_INFINITY, now)).toBe(true);
    expect(shouldCheckForUpdate('yesterday' as unknown as number, now)).toBe(true);
  });

  it('周期可以由调用方指定', () => {
    expect(shouldCheckForUpdate(now - 1000, now, 500)).toBe(true);
    expect(shouldCheckForUpdate(now - 1000, now, 5000)).toBe(false);
  });
});

describe('etagForRequest', () => {
  const written = Buffer.from(valid, 'utf8');
  const record = { etag: 'W/"abc"', sha256: grammarDigest(written) };

  it('磁盘内容与记录时一致才带 ETag', () => {
    expect(etagForRequest(record, grammarDigest(written))).toBe('W/"abc"');
  });

  it('扩展升级后文件被换回自带版本, 摘要不符时不带 ETag', () => {
    const bundled = Buffer.from(`${valid}\n`, 'utf8');
    expect(etagForRequest(record, grammarDigest(bundled))).toBeUndefined();
  });

  it('读不到磁盘文件时不带 ETag', () => {
    expect(etagForRequest(record, undefined)).toBeUndefined();
  });

  it('旧格式 (裸字符串) 或残缺记录一律不带 ETag', () => {
    const digest = grammarDigest(written);
    expect(etagForRequest('W/"abc"', digest)).toBeUndefined();
    expect(etagForRequest(undefined, digest)).toBeUndefined();
    expect(etagForRequest({ etag: '', sha256: digest }, digest)).toBeUndefined();
    expect(etagForRequest({ etag: 'x' }, digest)).toBeUndefined();
  });
});
