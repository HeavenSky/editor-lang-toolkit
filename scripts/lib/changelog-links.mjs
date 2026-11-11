/**
 * 把 Markdown 里指向本仓库的相对链接改写成 GitHub 绝对地址, 供 Release 说明使用。
 *
 * CHANGELOG 源文件保持相对路径 (本地预览, GitHub 文件页与 vsce 打包都按文件位置解析), 但抽出的
 * Release 正文没有源文件上下文, 相对链接在 Release 页面上会失效, 所以只在生成的正文里改写。
 *
 * - 链接 `[x](path)` → `<repo>/blob/<ref>/<解析后的路径>`; 图片 `![x](path)` → `<repo>/raw/<ref>/...`
 * - 纯锚点 `#a` 指回源文件的对应小节; 带协议的地址 (`https:`, `mailto:` 等) 与协议相对地址原样保留
 * - 路径按源文件所在目录用标准 URL 解析, 查询参数与片段随之保留
 */

const LINK = /(!?)\[([^\]]*)\]\(\s*([^)\s]+)((?:\s+"[^"]*")?\s*)\)/g;
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * @param {string} markdown
 * @param {{ repoUrl: string, ref: string, sourcePath: string }} options
 *   repoUrl 形如 `https://github.com/<owner>/<repo>`; sourcePath 为源文件相对仓库根的路径。
 */
export function absolutizeLinks(markdown, { repoUrl, ref, sourcePath }) {
	const repo = repoUrl.replace(/\/+$/, "");
	// 用一个虚拟根把仓库内路径的解析限制在仓库里: `..` 越过根时停在根上。
	const virtualRoot = "https://repo.invalid/";
	const source = new URL(sourcePath, virtualRoot);
	return markdown.replace(LINK, (match, bang, text, target, title) => {
		if (HAS_SCHEME.test(target) || target.startsWith("//")) return match;
		const resolved = new URL(target, source);
		const path = resolved.pathname.slice(1) + resolved.search + resolved.hash;
		const kind = bang ? "raw" : "blob";
		return `${bang}[${text}](${repo}/${kind}/${ref}/${path}${title})`;
	});
}

/** 从 `package.json` 的 `repository` 字段推出 GitHub 仓库地址, 推不出时返回 undefined。 */
export function repoUrlFromPackage(pkg) {
	const raw = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
	if (typeof raw !== "string") return undefined;
	const url = raw
		.replace(/^git\+/, "")
		.replace(/^github:/, "https://github.com/")
		.replace(/\.git$/, "");
	return /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(url) ? url : undefined;
}
