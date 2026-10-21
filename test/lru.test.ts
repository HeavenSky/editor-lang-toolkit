import { describe, expect, it, vi } from "vitest";

import { LruCache } from "../src/shared/lru";
import { debounce } from "../src/shared/debounce";

describe("LruCache", () => {
	it("容量必须是正整数", () => {
		expect(() => new LruCache<string, number>(0)).toThrow(RangeError);
		expect(() => new LruCache<string, number>(-1)).toThrow(RangeError);
		expect(() => new LruCache<string, number>(1.5)).toThrow(RangeError);
	});

	it("未命中返回 undefined", () => {
		expect(new LruCache<string, number>(2).get("missing")).toBeUndefined();
	});

	it("超出容量时逐出最久未使用的条目", () => {
		const evicted: string[] = [];
		const cache = new LruCache<string, number>(2, (_value, key) => evicted.push(key));
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(evicted).toEqual(["a"]);
		expect(cache.has("a")).toBe(false);
		expect(cache.size).toBe(2);
	});

	it("读取会把条目移到最新一端", () => {
		const evicted: string[] = [];
		const cache = new LruCache<string, number>(2, (_value, key) => evicted.push(key));
		cache.set("a", 1);
		cache.set("b", 2);
		cache.get("a"); // a 变成最新, 该被逐出的就成了 b
		cache.set("c", 3);
		expect(evicted).toEqual(["b"]);
		expect(cache.get("a")).toBe(1);
	});

	it("替换同一个 key 的值时旧值也会被逐出", () => {
		// 装饰类型是宿主资源, 覆盖写入若不释放旧值就是静默泄漏。
		const evicted: number[] = [];
		const cache = new LruCache<string, number>(2, value => evicted.push(value));
		cache.set("a", 1);
		cache.set("a", 2);
		expect(evicted).toEqual([1]);
		expect(cache.size).toBe(1);
		expect(cache.get("a")).toBe(2);
	});

	it("写入完全相同的值不触发逐出", () => {
		const evicted: number[] = [];
		const cache = new LruCache<string, number>(2, value => evicted.push(value));
		cache.set("a", 1);
		cache.set("a", 1);
		expect(evicted).toEqual([]);
	});

	it("clear 逐出全部条目", () => {
		const evicted: string[] = [];
		const cache = new LruCache<string, number>(4, (_value, key) => evicted.push(key));
		cache.set("a", 1);
		cache.set("b", 2);
		cache.clear();
		expect(evicted).toEqual(["a", "b"]);
		expect(cache.size).toBe(0);
	});

	it("容量为 1 时每次写入都逐出前一个", () => {
		const evicted: string[] = [];
		const cache = new LruCache<string, number>(1, (_value, key) => evicted.push(key));
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(evicted).toEqual(["a", "b"]);
	});
});

describe("LruCache: canEvict", () => {
	it("逐出时跳过仍在使用的条目, 改逐出下一个可逐出的", () => {
		const evicted: string[] = [];
		const pinned = new Set(["a"]);
		const cache = new LruCache<string, number>(
			2,
			(_v, k) => evicted.push(k),
			(_v, k) => !pinned.has(k)
		);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(evicted).toEqual(["b"]);
		expect(cache.has("a")).toBe(true);
		expect(cache.has("c")).toBe(true);
	});

	it("全部在使用时暂时超过上界, 不再使用后的下一次写入回落", () => {
		const evicted: string[] = [];
		const pinned = new Set(["a", "b", "c"]);
		const cache = new LruCache<string, number>(
			2,
			(_v, k) => evicted.push(k),
			(_v, k) => !pinned.has(k)
		);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(cache.size).toBe(3);
		expect(evicted).toEqual([]);

		pinned.clear();
		cache.set("d", 4);
		expect(evicted).toEqual(["a", "b"]);
		expect(cache.size).toBe(2);
		expect(cache.has("d")).toBe(true);
	});

	it("刚写入的条目不会被自己逐出", () => {
		const cache = new LruCache<string, number>(1, undefined, (_v, k) => k !== "a");
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.has("b")).toBe(true);
		expect(cache.size).toBe(2);
	});

	it("clear 不询问 canEvict", () => {
		const onEvict = vi.fn();
		const cache = new LruCache<string, number>(2, onEvict, () => false);
		cache.set("a", 1);
		cache.clear();
		expect(onEvict).toHaveBeenCalledTimes(1);
	});
});

describe("debounce", () => {
	it("连续调用只触发最后一次, 且用最后一次的参数", () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const debounced = debounce(fn, 100);
		debounced("a");
		debounced("b");
		debounced("c");
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith("c");
		vi.useRealTimers();
	});

	it("间隔超过延迟的调用各自触发", () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const debounced = debounce(fn, 100);
		debounced("a");
		vi.advanceTimersByTime(100);
		debounced("b");
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it("cancel 取消尚未触发的调用", () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		const debounced = debounce(fn, 100);
		debounced("a");
		debounced.cancel();
		vi.advanceTimersByTime(1000);
		expect(fn).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it("没有待触发调用时 cancel 是空操作", () => {
		const debounced = debounce(vi.fn(), 100);
		expect(() => debounced.cancel()).not.toThrow();
	});
});
