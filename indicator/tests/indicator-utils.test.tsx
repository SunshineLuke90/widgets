/**
 * Unit tests for indicator widget utility functions.
 *
 * Run with:  npm test  (from the client directory or the widget's directory)
 */
import {
	applyUnitPrefix,
	formatValue,
	computeAllValues,
	resolveExpressions,
	mergeWhereClauses,
	fontSizeToFlexGrow,
	buildExpressionValues
} from "../src/runtime/utils"

// ── applyUnitPrefix ───────────────────────────────────────────────────────────

describe("applyUnitPrefix", () => {
	it("formats thousands as k with 1 decimal place by default", () => {
		expect(applyUnitPrefix(2518)).toBe("2.5k")
	})

	it("respects maxDecimalPlaces=2", () => {
		expect(applyUnitPrefix(2518, 2)).toBe("2.52k")
	})

	it("formats millions", () => {
		expect(applyUnitPrefix(1_500_000, 1)).toBe("1.5M")
	})

	it("formats billions", () => {
		expect(applyUnitPrefix(2_000_000_000, 1)).toBe("2B")
	})

	it("formats trillions", () => {
		expect(applyUnitPrefix(1_200_000_000_000, 1)).toBe("1.2T")
	})

	it("leaves small numbers unchanged", () => {
		expect(applyUnitPrefix(999, 1)).toBe("999")
	})

	it("handles negative numbers", () => {
		expect(applyUnitPrefix(-2518, 1)).toBe("-2.5k")
	})

	it("handles zero", () => {
		expect(applyUnitPrefix(0, 1)).toBe("0")
	})

	it("rounds correctly at boundary", () => {
		// 1000 exactly → 1k
		expect(applyUnitPrefix(1000, 0)).toBe("1k")
	})

	it("maxDecimalPlaces=0 gives no decimals", () => {
		expect(applyUnitPrefix(2518, 0)).toBe("3k")
	})
})

// ── formatValue ───────────────────────────────────────────────────────────────

describe("formatValue", () => {
	it("returns '--' for null", () => {
		expect(formatValue(null, {})).toBe("--")
	})

	it("returns '--' for undefined", () => {
		expect(formatValue(undefined, {})).toBe("--")
	})

	it("applies unit prefix when enabled", () => {
		expect(formatValue(2518, { unitPrefix: true, maxDecimalPlaces: 1 })).toBe(
			"2.5k"
		)
	})

	it("applies prefix and suffix with unit prefix", () => {
		expect(
			formatValue(2518, {
				unitPrefix: true,
				maxDecimalPlaces: 1,
				prefix: "$",
				suffix: "!"
			})
		).toBe("$2.5k!")
	})

	it("formats with digit grouping", () => {
		const result = formatValue(1234567, {
			digitGrouping: true,
			maxDecimalPlaces: 0
		})
		expect(result).toBe("1,234,567")
	})

	it("applies prefix and suffix without unit prefix", () => {
		expect(
			formatValue(42, { prefix: "~", suffix: " items", maxDecimalPlaces: 0 })
		).toBe("~42 items")
	})

	it("respects maxDecimalPlaces without unit prefix", () => {
		expect(formatValue(3.14159, { maxDecimalPlaces: 2 })).toBe("3.14")
	})
})

// ── computeAllValues ──────────────────────────────────────────────────────────

describe("computeAllValues", () => {
	it("returns nulls when both values are null", () => {
		const result = computeAllValues(null, null)
		expect(result.difference).toBeNull()
		expect(result.percentage).toBeNull()
		expect(result.ratio).toBeNull()
	})

	it("computes difference", () => {
		expect(computeAllValues(100, 80).difference).toBe(20)
	})

	it("computes absolute difference", () => {
		expect(computeAllValues(80, 100).absoluteDifference).toBe(20)
	})

	it("computes percentage (value / reference * 100)", () => {
		expect(computeAllValues(50, 100).percentage).toBe(50)
	})

	it("computes percentChange ((value - ref) / ref * 100)", () => {
		expect(computeAllValues(120, 100).percentChange).toBeCloseTo(20)
	})

	it("computes ratio", () => {
		expect(computeAllValues(300, 100).ratio).toBe(3)
	})

	it("computes ratioChange (ratio - 1)", () => {
		expect(computeAllValues(300, 100).ratioChange).toBe(2)
	})

	it("avoids division by zero for percentage", () => {
		expect(computeAllValues(100, 0).percentage).toBeNull()
	})

	it("avoids division by zero for ratio", () => {
		expect(computeAllValues(100, 0).ratio).toBeNull()
	})

	it("returns null for derived values when ref is null", () => {
		const result = computeAllValues(100, null)
		expect(result.difference).toBeNull()
		expect(result.percentage).toBeNull()
	})

	it("preserves main value", () => {
		expect(computeAllValues(42, 10).value).toBe(42)
	})

	it("preserves reference value", () => {
		expect(computeAllValues(42, 10).reference).toBe(10)
	})
})

// ── resolveExpressions ────────────────────────────────────────────────────────

describe("resolveExpressions", () => {
	const values = {
		value: "125",
		reference: "100",
		difference: "25"
	}

	it("replaces a single expression", () => {
		expect(resolveExpressions("{calculated/value} people", values)).toBe(
			"125 people"
		)
	})

	it("replaces multiple expressions", () => {
		expect(
			resolveExpressions(
				"{calculated/value} out of {calculated/reference}",
				values
			)
		).toBe("125 out of 100")
	})

	it("leaves unmatched expressions unchanged", () => {
		expect(resolveExpressions("{calculated/unknown}", values)).toBe(
			"{calculated/unknown}"
		)
	})

	it("returns empty string for null/undefined input", () => {
		expect(resolveExpressions(null, values)).toBe("")
		expect(resolveExpressions(undefined, values)).toBe("")
	})

	it("returns plain text unchanged", () => {
		expect(resolveExpressions("Total Count", values)).toBe("Total Count")
	})

	it("handles empty text", () => {
		expect(resolveExpressions("", values)).toBe("")
	})
})

// ── mergeWhereClauses ─────────────────────────────────────────────────────────

describe("mergeWhereClauses", () => {
	it("returns '1=1' when both are '1=1'", () => {
		expect(mergeWhereClauses("1=1", "1=1")).toBe("1=1")
	})

	it("returns the non-trivial clause when one is '1=1'", () => {
		expect(mergeWhereClauses("1=1", "TYPE = 'A'")).toBe("TYPE = 'A'")
		expect(mergeWhereClauses("TYPE = 'A'", "1=1")).toBe("TYPE = 'A'")
	})

	it("combines two non-trivial clauses with AND", () => {
		expect(mergeWhereClauses("A = 1", "B = 2")).toBe("(A = 1) AND (B = 2)")
	})

	it("handles empty strings as '1=1'", () => {
		expect(mergeWhereClauses("", "B = 2")).toBe("B = 2")
	})
})

// ── fontSizeToFlexGrow ────────────────────────────────────────────────────────

describe("fontSizeToFlexGrow", () => {
	it("returns larger values for larger sizes", () => {
		const small = fontSizeToFlexGrow("small")
		const large = fontSizeToFlexGrow("large")
		const xxLarge = fontSizeToFlexGrow("xx-large")
		expect(large).toBeGreaterThan(small)
		expect(xxLarge).toBeGreaterThan(large)
	})

	it("falls back gracefully for unknown size", () => {
		expect(fontSizeToFlexGrow("unknown-size")).toBeGreaterThan(0)
	})
})

// ── buildExpressionValues ─────────────────────────────────────────────────────

describe("buildExpressionValues", () => {
	const mockConfig = {
		valueUnitPrefix: false,
		valueDigitGrouping: false,
		valueMinDecimalPlaces: 0,
		valueMaxDecimalPlaces: 2,
		valuePrefix: "",
		valueSuffix: "",
		pctDigitGrouping: false,
		pctMinDecimalPlaces: 0,
		pctMaxDecimalPlaces: 1,
		pctPrefix: "",
		pctSuffix: "%",
		ratioDigitGrouping: false,
		ratioMinDecimalPlaces: 0,
		ratioMaxDecimalPlaces: 2,
		ratioPrefix: "",
		ratioSuffix: ""
	}

	it("provides a 'value' key with formatted main value", () => {
		const computed = computeAllValues(125, 100)
		const result = buildExpressionValues(computed, mockConfig)
		expect(result.value).toBe("125")
	})

	it("provides a 'percentage' key formatted with pct config", () => {
		const computed = computeAllValues(75, 100)
		const result = buildExpressionValues(computed, mockConfig)
		// 75/100 * 100 = 75%, formatted with suffix "%"
		expect(result.percentage).toContain("75")
		expect(result.percentage).toContain("%")
	})

	it("returns '--' for null derived values", () => {
		const computed = computeAllValues(100, null)
		const result = buildExpressionValues(computed, mockConfig)
		expect(result.difference).toBe("--")
		expect(result.percentage).toBe("--")
	})

	it("uses unit prefix for value when configured", () => {
		const configWithPrefix = {
			...mockConfig,
			valueUnitPrefix: true,
			valueMaxDecimalPlaces: 1
		}
		const computed = computeAllValues(2518, null)
		const result = buildExpressionValues(computed, configWithPrefix)
		expect(result.value).toBe("2.5k")
	})
})
