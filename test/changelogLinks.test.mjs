import { describe, expect, it } from "vitest";

import { absolutizeLinks, repoUrlFromPackage } from "../scripts/lib/changelog-links.mjs";

const options = { repoUrl: "https://github.com/o/r", ref: "v1.0.0", sourcePath: "CHANGELOG.md" };

describe("absolutizeLinks", () => {
	it("相对链接按源文件目录解析为 blob 地址, 保留片段与查询参数", () => {
		expect(absolutizeLinks("[a](./docs/x.md#y) [b](docs/z.md?p=1)", options)).toBe(
			"[a](https://github.com/o/r/blob/v1.0.0/docs/x.md#y) [b](https://github.com/o/r/blob/v1.0.0/docs/z.md?p=1)"
		);
	});

	it("子目录源文件的 `../` 路径按其所在目录解析", () => {
		const zh = { ...options, sourcePath: "zh/CHANGELOG.md" };
		expect(absolutizeLinks("[a](./docs/x.md) [b](../LICENSE.txt)", zh)).toBe(
			"[a](https://github.com/o/r/blob/v1.0.0/zh/docs/x.md) [b](https://github.com/o/r/blob/v1.0.0/LICENSE.txt)"
		);
	});

	it("图片改写为 raw 地址, 标题保留", () => {
		expect(absolutizeLinks('![s](media/a.png "t")', options)).toBe(
			'![s](https://github.com/o/r/raw/v1.0.0/media/a.png "t")'
		);
	});

	it("纯锚点指回源文件的小节", () => {
		expect(absolutizeLinks("[a](#v001)", options)).toBe(
			"[a](https://github.com/o/r/blob/v1.0.0/CHANGELOG.md#v001)"
		);
	});

	it("外部地址与协议相对地址原样保留", () => {
		const text = "[a](https://x.dev/p) [b](mailto:a@b.c) [c](//cdn.x/a.png)";
		expect(absolutizeLinks(text, options)).toBe(text);
	});
});

describe("repoUrlFromPackage", () => {
	it("从 git+https 与 .git 后缀中推出仓库地址", () => {
		expect(repoUrlFromPackage({ repository: { url: "git+https://github.com/o/r.git" } })).toBe(
			"https://github.com/o/r"
		);
		expect(repoUrlFromPackage({ repository: "github:o/r" })).toBe("https://github.com/o/r");
	});

	it("非 GitHub 或缺失时返回 undefined", () => {
		expect(
			repoUrlFromPackage({ repository: { url: "https://gitlab.com/o/r" } })
		).toBeUndefined();
		expect(repoUrlFromPackage({})).toBeUndefined();
	});
});
