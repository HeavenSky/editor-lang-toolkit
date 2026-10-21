/**
 * 定位 `uv` 可执行文件 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * 从 Dock 或 Finder 启动的 VS Code 不一定继承登录 shell 的 PATH, 这时 `uv` 明明装了也找不到,
 * 调试会以 `spawn uv ENOENT` 这种看不懂的错误失败。所以 PATH 里没有时, 再按官方安装脚本,
 * cargo, Homebrew, MacPorts 的默认位置逐个找一遍。
 */
import { delimiter, join } from "node:path";

export interface UvLookup {
	/** 用户在调试配置里显式给的路径, 有就直接用, 不做存在性检查 (交给启动时报错)。 */
	configured?: string;
	path: string | undefined;
	home: string;
	platform: NodeJS.Platform;
	exists: (file: string) => boolean;
}

export function findUv({ configured, path, home, platform, exists }: UvLookup): string | undefined {
	if (configured) return configured;
	const names = platform === "win32" ? ["uv.exe", "uv"] : ["uv"];
	const fromPath = (path ?? "")
		.split(delimiter)
		.filter(dir => dir.length > 0)
		.flatMap(dir => names.map(name => join(dir, name)));
	const fallbacks =
		platform === "win32"
			? [join(home, ".local", "bin", "uv.exe"), join(home, ".cargo", "bin", "uv.exe")]
			: [
					join(home, ".local", "bin", "uv"),
					join(home, ".cargo", "bin", "uv"),
					"/opt/homebrew/bin/uv",
					"/opt/local/bin/uv",
					"/usr/local/bin/uv",
				];
	return [...fromPath, ...fallbacks].find(file => exists(file));
}
