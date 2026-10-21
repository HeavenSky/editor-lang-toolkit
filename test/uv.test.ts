import { delimiter, join } from "node:path";

import { describe, expect, it } from "vitest";

import { findUv } from "../src/shared/uv";

const home = "/home/me";
const lookup = (present: string[], path?: string, configured?: string) =>
	findUv({ configured, path, home, platform: "darwin", exists: file => present.includes(file) });

describe("findUv", () => {
	it("显式配置优先, 且不检查是否存在", () => {
		expect(lookup([], "/usr/bin", "/custom/uv")).toBe("/custom/uv");
	});

	it("优先使用 PATH 中靠前的那个", () => {
		const path = ["/a", "/b"].join(delimiter);
		expect(lookup(["/b/uv", "/a/uv"], path)).toBe("/a/uv");
	});

	it("PATH 里没有时回退到常见安装位置", () => {
		expect(lookup([join(home, ".local", "bin", "uv")], "/usr/bin")).toBe(
			join(home, ".local", "bin", "uv")
		);
		expect(lookup(["/opt/homebrew/bin/uv"], undefined)).toBe("/opt/homebrew/bin/uv");
	});

	it("哪里都没有时返回 undefined, 由调用方给出可读提示", () => {
		expect(lookup([], "/usr/bin")).toBeUndefined();
	});

	it("Windows 下找 uv.exe", () => {
		// 测试机不一定是 Windows, PATH 分隔符随宿主平台变化, 所以这里只放一个不含分隔符的目录。
		const found = findUv({
			path: "tools",
			home: "me",
			platform: "win32",
			exists: file => file === join("tools", "uv.exe"),
		});
		expect(found).toBe(join("tools", "uv.exe"));
	});
});
