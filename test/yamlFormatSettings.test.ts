import { describe, expect, it } from "vitest";

import { withYamlFormatDefault } from "../src/features/yamlFormatSettings";

describe("yaml.format.enable 默认桥接", () => {
	it("缺省时补上默认 true", () => {
		expect(withYamlFormatDefault("yaml", undefined)).toEqual({ format: { enable: true } });
		expect(withYamlFormatDefault("yaml", {})).toEqual({ format: { enable: true } });
		expect(withYamlFormatDefault("yaml", { hover: true })).toEqual({
			hover: true,
			format: { enable: true },
		});
		expect(withYamlFormatDefault("yaml", { format: { printWidth: 80 } })).toEqual({
			format: { printWidth: 80, enable: true },
		});
		expect(withYamlFormatDefault("yaml.format", undefined)).toEqual({ enable: true });
		expect(withYamlFormatDefault("yaml.format", { printWidth: 100 })).toEqual({
			printWidth: 100,
			enable: true,
		});
		expect(withYamlFormatDefault("yaml.format.enable", null)).toBe(true);
		expect(withYamlFormatDefault("yaml.format.enable", undefined)).toBe(true);
	});

	it("显式设置过的值原样保留, 含 false", () => {
		expect(withYamlFormatDefault("yaml", { format: { enable: false } })).toEqual({
			format: { enable: false },
		});
		expect(
			withYamlFormatDefault("yaml", { format: { enable: true, singleQuote: true } })
		).toEqual({ format: { enable: true, singleQuote: true } });
		expect(withYamlFormatDefault("yaml.format", { enable: false })).toEqual({ enable: false });
		expect(withYamlFormatDefault("yaml.format.enable", false)).toBe(false);
		expect(withYamlFormatDefault("yaml.format.enable", true)).toBe(true);
	});

	it("无关 section 原样透传", () => {
		const http = { proxy: "http://127.0.0.1:8080" };
		expect(withYamlFormatDefault("http", http)).toBe(http);
		expect(withYamlFormatDefault("editor", { tabSize: 2 })).toEqual({ tabSize: 2 });
		expect(withYamlFormatDefault(undefined, null)).toBeNull();
		expect(withYamlFormatDefault(null, "x")).toBe("x");
	});
});
