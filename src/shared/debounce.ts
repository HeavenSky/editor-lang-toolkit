/**
 * 尾沿去抖 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * ANSI 装饰每次都要全量重解析文档 (解析器本身没有增量能力), 所以连续输入时必须去抖,
 * 否则每一次按键都会重扫整个文件。上游 vscode-ansi 没做这件事, vt100 做了。
 *
 * 只保留最后一次调用的参数: 中间那些状态已经被后来的输入取代, 算了也是白算。
 */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** 取消尚未触发的那一次调用。 */
  cancel(): void;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
  schedule: (callback: () => void, ms: number) => unknown = setTimeout,
  unschedule: (handle: unknown) => void = (handle) => clearTimeout(handle as never),
): Debounced<A> {
  let handle: unknown;

  const debounced = (...args: A): void => {
    if (handle !== undefined) unschedule(handle);
    handle = schedule(() => {
      handle = undefined;
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = (): void => {
    if (handle === undefined) return;
    unschedule(handle);
    handle = undefined;
  };

  return debounced;
}
