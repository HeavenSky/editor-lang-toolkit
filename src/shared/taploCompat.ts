/**
 * 绕开内置 taplo 0.8.0 两处会让 TOML 语言服务器失效的缺陷。两处都只能在数据进入 wasm 之前
 * 改写来规避, 上游发布修复后整份删除。
 *
 * 1. **SchemaStore 目录被拒。** taplo 只认 `$schema` 为旧地址的目录, SchemaStore 现在返回新地址,
 *    整个目录反序列化失败 (`data did not match any variant of untagged enum SchemaCatalog`),
 *    按文件名匹配 schema 随之失效。上游修复见 tamasfe/taplo@08f343b, 未发布到 npm。
 * 2. **补全栈溢出。** `Schemas::collect_child_schemas` 处理 `{ "allOf": [...] }` 时本想先删掉
 *    `allOf` 再合并, 但对数组调用了 `as_object_mut()`, 删除不生效; 合并结果里仍有 `allOf`,
 *    只要合并后没有 `properties`/`oneOf`/`anyOf`, 就以同样的深度递归到栈溢出, 整个进程退出。
 *    schemars 生成的 `{ "description": ..., "allOf": [{ "$ref": ... }] }` (例: codex 的配置
 *    schema) 正好命中。给这类节点补一个空的 `properties` 让 taplo 走普通分支 —— 空
 *    `properties` 不施加任何校验约束, 而原分支在这些节点上只会崩溃, 没有可丢的功能。
 */

export const CATALOG_SCHEMA_NEW = "https://www.schemastore.org/schema-catalog.json";
export const CATALOG_SCHEMA_OLD = "https://json.schemastore.org/schema-catalog.json";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function present(node: JsonObject, key: string): boolean {
	return node[key] !== undefined && node[key] !== null;
}

/** 按 JSON Pointer 片段在文档内取值; 只处理 taplo 能解析的 `#...` 引用。 */
function resolveLocalRef(root: JsonObject, ref: string): unknown {
	let current: unknown = root;
	for (const raw of ref.replace(/^#\/?/, "").split("/")) {
		if (raw === "") continue;
		const segment = decodeURIComponent(raw).replaceAll("~1", "/").replaceAll("~0", "~");
		if (!isObject(current) && !Array.isArray(current)) return undefined;
		current = (current as JsonObject)[segment];
	}
	return current;
}

/**
 * 判断该节点会不会让 taplo 的 allOf 合并分支无限递归, 条件与上游代码逐项对应:
 * 节点本身只有 `allOf` 一种组合且没有 `properties`, 合并后的结果也没有这三个键。
 */
function loopsInAllOfMerge(node: JsonObject, root: JsonObject): boolean {
	const allOf = node.allOf;
	if (!Array.isArray(allOf) || allOf.length === 0) return false;
	if (present(node, "properties") || present(node, "oneOf") || present(node, "anyOf")) {
		return false;
	}
	if (typeof node.$ref === "string") return false; // `$ref` 先于 allOf 处理, 走不到合并分支。
	return allOf.every(item => {
		let merged: unknown = item;
		if (isObject(item) && typeof item.$ref === "string") {
			// 远程引用在这里拿不到内容, 按会循环处理: 漏改的代价是进程崩溃, 误改只少几条补全。
			merged = item.$ref.startsWith("#") ? resolveLocalRef(root, item.$ref) : undefined;
		}
		return (
			!isObject(merged) ||
			!(present(merged, "properties") || present(merged, "oneOf") || present(merged, "anyOf"))
		);
	});
}

/** 原地改写一份 schema 文档, 返回是否有改动。 */
export function patchSchemaDocument(root: unknown): boolean {
	if (!isObject(root)) return false;
	let changed = false;
	const seen = new Set<unknown>();
	const stack: unknown[] = [root];
	while (stack.length > 0) {
		const value = stack.pop();
		if (typeof value !== "object" || value === null || seen.has(value)) continue;
		seen.add(value);
		if (Array.isArray(value)) {
			stack.push(...value);
			continue;
		}
		const node = value as JsonObject;
		if (loopsInAllOfMerge(node, root)) {
			node.properties = {};
			changed = true;
		}
		stack.push(...Object.values(node));
	}
	return changed;
}

/**
 * 改写 taplo 将要读到的一段 JSON 文本 (网络响应或 schema 缓存文件), 无需改写时返回 undefined。
 * 缓存文件形如 `{ "expires_by": ..., "url": ..., "value": <schema> }`, 旧版本扩展写下的缓存
 * 未经改写, 读取时同样要处理。
 */
export function patchTaploJson(text: string): string | undefined {
	const mayBeCatalog = text.includes(CATALOG_SCHEMA_NEW);
	if (!mayBeCatalog && !text.includes('"allOf"')) return undefined;
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (!isObject(body)) return undefined;
	const target = isObject(body.value) && "expires_by" in body ? body.value : body;
	let changed = false;
	if (mayBeCatalog && target.$schema === CATALOG_SCHEMA_NEW) {
		target.$schema = CATALOG_SCHEMA_OLD;
		changed = true;
	}
	if (patchSchemaDocument(target)) changed = true;
	return changed ? JSON.stringify(body) : undefined;
}
