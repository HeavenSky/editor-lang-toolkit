/**
 * `yaml.format.enable` 的默认值桥接 —— 纯逻辑, 不 import vscode, 由 vitest 直接覆盖。
 *
 * 捆绑的 yaml-language-server 在客户端支持动态注册时不静态声明格式化能力, 只有从
 * `workspace/configuration` 读到真值 `yaml.format.enable` 才注册 `textDocument/formatting`
 * (证据: `node_modules/yaml-language-server/out/server/src/languageserver/handlers/
 * settingsHandlers.js` 的 `enableFormatter`)。Red Hat 的 YAML 扩展会声明这个设置的默认值,
 * 而本扩展单独安装时 `yaml` 节没有任何人定义 —— 于是格式化整个缺失, 与 `docs/schemas.md`
 * 的 Format YAML 承诺相悖。也不能把这个键声明进 package.json: 与 Red Hat 扩展重复声明
 * 同一配置键会被 VS Code 忽略其一。所以默认值只能在客户端的配置响应里补。
 *
 * 显式设置过的值 (含 false) 原样放行, 保留用户显式关闭的语义; 无关 section 原样透传。
 */

export const YAML_FORMAT_ENABLE_DEFAULT = true;

/**
 * 补齐一个配置响应项: `section` 是 `yaml`, `yaml.format` 或 `yaml.format.enable` 且对应值
 * 未显式给出 `enable` 时, 注入默认值; 其余原样返回。
 */
export function withYamlFormatDefault(section: string | null | undefined, value: unknown): unknown {
	if (section === "yaml") {
		const yaml = asRecord(value);
		const format = asRecord(yaml.format);
		if (typeof format.enable === "boolean") return value;
		return { ...yaml, format: { ...format, enable: YAML_FORMAT_ENABLE_DEFAULT } };
	}

	if (section === "yaml.format") {
		const format = asRecord(value);
		if (typeof format.enable === "boolean") return value;
		return { ...format, enable: YAML_FORMAT_ENABLE_DEFAULT };
	}

	if (section === "yaml.format.enable") {
		return typeof value === "boolean" ? value : YAML_FORMAT_ENABLE_DEFAULT;
	}

	return value;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
