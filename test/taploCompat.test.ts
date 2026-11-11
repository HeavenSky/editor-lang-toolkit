import { describe, expect, it } from "vitest";

import {
	CATALOG_SCHEMA_NEW,
	CATALOG_SCHEMA_OLD,
	patchSchemaDocument,
	patchTaploJson,
} from "../src/shared/taploCompat";

describe("patchTaploJson", () => {
	it("把 SchemaStore 目录的新 $schema 改回 taplo 认的旧地址", () => {
		const text = JSON.stringify({ $schema: CATALOG_SCHEMA_NEW, version: 1, schemas: [] });
		expect(JSON.parse(patchTaploJson(text)!).$schema).toBe(CATALOG_SCHEMA_OLD);
	});

	it("只认顶层 $schema, 正文里出现新地址不算目录", () => {
		const text = JSON.stringify({ description: CATALOG_SCHEMA_NEW });
		expect(patchTaploJson(text)).toBeUndefined();
	});

	it("改写 schema 缓存文件里的 value", () => {
		const text = JSON.stringify({
			expires_by: [2026, 1, 0, 0, 0, 0, 0, 0, 0],
			url: "https://example.com/s.json",
			value: { properties: { a: { allOf: [{ type: "string" }] } } },
		});
		const patched = JSON.parse(patchTaploJson(text)!);
		expect(patched.value.properties.a.properties).toEqual({});
		expect(patched.url).toBe("https://example.com/s.json");
	});

	it("非 JSON 与无需改写的文本原样放行", () => {
		expect(patchTaploJson('[tool]\nallOf = "x"\n')).toBeUndefined();
		expect(patchTaploJson('{"type":"object"}')).toBeUndefined();
	});
});

describe("patchSchemaDocument", () => {
	it("allOf 引用的定义没有 properties 时补空 properties", () => {
		const schema = {
			definitions: { Color: { enum: ["auto", "yes"], type: "string" } },
			properties: {
				color: { description: "颜色", allOf: [{ $ref: "#/definitions/Color" }] },
			},
		};
		expect(patchSchemaDocument(schema)).toBe(true);
		expect(schema.properties.color).toHaveProperty("properties", {});
	});

	it("allOf 引用的定义带 properties/oneOf/anyOf 时不动, taplo 能正常合并", () => {
		for (const extra of [
			{ properties: { x: {} } },
			{ oneOf: [{ type: "string" }] },
			{ anyOf: [{ type: "string" }] },
		]) {
			const schema = {
				definitions: { Obj: extra },
				properties: { a: { allOf: [{ $ref: "#/definitions/Obj" }] } },
			};
			expect(patchSchemaDocument(schema)).toBe(false);
		}
	});

	it("节点自带 properties, oneOf, anyOf 或 $ref 时走不到合并分支, 不动", () => {
		const nodes = [
			{ allOf: [{ type: "string" }], properties: {} },
			{ allOf: [{ type: "string" }], oneOf: [{}] },
			{ allOf: [{ type: "string" }], anyOf: [{}] },
			{ allOf: [{ type: "string" }], $ref: "#/definitions/X" },
			{ allOf: [] },
		];
		for (const node of nodes)
			expect(patchSchemaDocument({ properties: { a: node } })).toBe(false);
	});

	it("远程引用无法展开, 按会循环处理", () => {
		const schema = { properties: { a: { allOf: [{ $ref: "https://example.com/x.json" }] } } };
		expect(patchSchemaDocument(schema)).toBe(true);
	});

	it("JSON Pointer 的转义段能解析", () => {
		const schema = {
			definitions: { "a/b": { properties: { x: {} } } },
			properties: { a: { allOf: [{ $ref: "#/definitions/a~1b" }] } },
		};
		expect(patchSchemaDocument(schema)).toBe(false);
	});
});
