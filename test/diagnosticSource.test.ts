import { describe, expect, it } from "vitest";

import {
	rewriteTaploSource,
	TAPLO_UPSTREAM_SOURCE,
	TOML_SOURCE,
} from "../src/shared/diagnosticSource";

describe("rewriteTaploSource", () => {
	it("把上游扩展名改写成 TOML", () => {
		const diagnostics = [
			{ source: TAPLO_UPSTREAM_SOURCE, message: "schema validation failed" },
		];
		expect(rewriteTaploSource(diagnostics)).toBe(diagnostics);
		expect(diagnostics[0]?.source).toBe(TOML_SOURCE);
	});

	it("其他来源与缺省来源原样保留", () => {
		const diagnostics: { source?: string }[] = [
			{ source: "taplo" },
			{},
			{ source: "even better toml" },
		];
		rewriteTaploSource(diagnostics);
		expect(diagnostics.map(d => d.source)).toEqual(["taplo", undefined, "even better toml"]);
	});
});
