/**
 * 带逐出回调的 LRU 缓存 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * 存在的理由很具体: ANSI 装饰按"样式组合"缓存 `TextEditorDecorationType`, 而真彩色
 * (`\x1b[38;2;r;g;b`) 让样式组合的取值空间变成 1600 万级。一份色彩丰富的日志能创建出成千
 * 上万个 decoration type, 每一个都是宿主侧的真实资源, 且不会自己释放 —— 上游 vscode-ansi
 * 就是无界增长的。这里给它一个上界, 并保证逐出时能把资源真正 dispose 掉。
 *
 * 用 `Map` 的插入顺序实现 LRU: JS 的 Map 保证按插入顺序迭代, 命中时删掉再插一次即可把
 * 条目移到"最新"一端, 迭代器的第一项就是最久未使用的。
 */
export class LruCache<K, V> {
  private readonly _entries = new Map<K, V>();

  /**
   * @param capacity  上界, 必须为正数
   * @param onEvict   逐出与清空时调用, 用于释放宿主资源
   * @param canEvict  容量逐出前询问; 返回 false 的条目 (仍在使用中) 本次跳过。全部条目都在
   *                  使用时缓存会暂时超过上界, 直到之后某次写入时它们不再被使用才回落。
   *                  `clear` 不询问, 照常全部逐出。
   */
  public constructor(
    private readonly capacity: number,
    private readonly onEvict: (value: V, key: K) => void = () => undefined,
    private readonly canEvict: (value: V, key: K) => boolean = () => true,
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`);
    }
  }

  public get size(): number {
    return this._entries.size;
  }

  public has(key: K): boolean {
    return this._entries.has(key);
  }

  /** 命中时把条目移到最新一端; 未命中返回 undefined。 */
  public get(key: K): V | undefined {
    if (!this._entries.has(key)) return undefined;
    const value = this._entries.get(key) as V;
    this._entries.delete(key);
    this._entries.set(key, value);
    return value;
  }

  /** 写入并在超出容量时逐出最久未使用的条目。重复写入同一个 key 会先逐出旧值。 */
  public set(key: K, value: V): void {
    const previous = this._entries.get(key);
    if (previous !== undefined) {
      this._entries.delete(key);
      // 同一个 key 换了值, 旧值同样要释放 —— 否则替换会静默泄漏。
      if (previous !== value) this.onEvict(previous, key);
    }
    this._entries.set(key, value);

    if (this._entries.size <= this.capacity) return;
    // 从最久未使用的一端往新的一端扫; 刚写入的条目在最末, 不参与本次逐出。
    const candidates = [...this._entries].slice(0, -1);
    for (const [candidateKey, candidate] of candidates) {
      if (this._entries.size <= this.capacity) break;
      if (!this.canEvict(candidate, candidateKey)) continue;
      this._entries.delete(candidateKey);
      this.onEvict(candidate, candidateKey);
    }
  }

  /** 清空并逐出全部条目。 */
  public clear(): void {
    for (const [key, value] of this._entries) this.onEvict(value, key);
    this._entries.clear();
  }
}
