import type { Config } from "../config"

// ── Font size helpers ─────────────────────────────────────────────────────────

const FONT_SIZE_SCALE: { [key: string]: number } = {
	"xx-small": 1,
	"x-small": 1.5,
	small: 2,
	medium: 2.5,
	large: 3,
	"x-large": 4,
	"xx-large": 5
}

export function fontSizeToFlexGrow(size: string): number {
	return FONT_SIZE_SCALE[size] ?? 2.5
}

// ── Value formatting ──────────────────────────────────────────────────────────

/**
 * Convert an absolute numeric value to a compact string using SI unit prefixes
 * (k, M, B, T).  Only applies to values ≥ 1000.
 *
 * Example: applyUnitPrefix(2518, 1) → "2.5k"
 *          applyUnitPrefix(2518, 2) → "2.52k"
 */
export function applyUnitPrefix(value: number, maxDecimalPlaces = 1): string {
	const abs = Math.abs(value)
	const sign = value < 0 ? "-" : ""

	const fmt = (n: number) => trimDecimals(n, maxDecimalPlaces)

	if (abs >= 1e12) return `${sign}${fmt(abs / 1e12)}T`
	if (abs >= 1e9) return `${sign}${fmt(abs / 1e9)}B`
	if (abs >= 1e6) return `${sign}${fmt(abs / 1e6)}M`
	if (abs >= 1e3) return `${sign}${fmt(abs / 1e3)}k`
	return `${sign}${fmt(abs)}`
}

function trimDecimals(value: number, maxDecimals: number): string {
	const factor = Math.pow(10, maxDecimals)
	const rounded = Math.round(value * factor) / factor
	// Use a plain locale-independent representation to avoid locale issues in tests
	return rounded.toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxDecimals
	})
}

export interface FormatConfig {
	digitGrouping?: boolean
	minDecimalPlaces?: number
	maxDecimalPlaces?: number
	prefix?: string
	suffix?: string
	unitPrefix?: boolean
}

/**
 * Format a numeric value according to the provided format config.
 * Returns "--" when value is null or undefined.
 */
export function formatValue(
	value: number | null | undefined,
	cfg: FormatConfig
): string {
	if (value === null || value === undefined) return "--"

	if (cfg.unitPrefix) {
		const compact = applyUnitPrefix(value, cfg.maxDecimalPlaces ?? 1)
		return `${cfg.prefix ?? ""}${compact}${cfg.suffix ?? ""}`
	}

	const formatted = value.toLocaleString("en-US", {
		minimumFractionDigits: cfg.minDecimalPlaces ?? 0,
		maximumFractionDigits: cfg.maxDecimalPlaces ?? 2,
		useGrouping: cfg.digitGrouping ?? false
	})
	return `${cfg.prefix ?? ""}${formatted}${cfg.suffix ?? ""}`
}

// ── Derived value computation ─────────────────────────────────────────────────

export interface ComputedValues {
	value: number | null
	reference: number | null
	difference: number | null
	absoluteDifference: number | null
	percentage: number | null
	percentChange: number | null
	ratio: number | null
	ratioChange: number | null
}

/**
 * Compute all derived indicator values from the main and reference values.
 */
export function computeAllValues(
	main: number | null,
	ref: number | null
): ComputedValues {
	const difference = main !== null && ref !== null ? main - ref : null

	const absoluteDifference = difference !== null ? Math.abs(difference) : null

	const percentage =
		main !== null && ref !== null && ref !== 0 ? (main / ref) * 100 : null

	const percentChange =
		main !== null && ref !== null && ref !== 0
			? ((main - ref) / ref) * 100
			: null

	const ratio = main !== null && ref !== null && ref !== 0 ? main / ref : null

	const ratioChange = ratio !== null ? ratio - 1 : null

	return {
		value: main,
		reference: ref,
		difference,
		absoluteDifference,
		percentage,
		percentChange,
		ratio,
		ratioChange
	}
}

// ── Expression resolution ─────────────────────────────────────────────────────

/**
 * Replace all `{calculated/<key>}` tokens in `text` with the matching entry
 * from `values`.  Tokens without a matching key are left unchanged.
 */
export function resolveExpressions(
	text: string | undefined | null,
	values: { [key: string]: string }
): string {
	if (!text) return ""
	return text.replace(/\{calculated\/([^}]+)\}/g, (match, key: string) =>
		key in values ? values[key] : match
	)
}

// ── Build resolved text from config ──────────────────────────────────────────

/**
 * Build the string value map used in expression resolution for an indicator,
 * given pre-computed values and the widget config.
 */
export function buildExpressionValues(
	computed: ComputedValues,
	config: Pick<
		Config,
		| "valueUnitPrefix"
		| "valueDigitGrouping"
		| "valueMinDecimalPlaces"
		| "valueMaxDecimalPlaces"
		| "valuePrefix"
		| "valueSuffix"
		| "pctDigitGrouping"
		| "pctMinDecimalPlaces"
		| "pctMaxDecimalPlaces"
		| "pctPrefix"
		| "pctSuffix"
		| "ratioDigitGrouping"
		| "ratioMinDecimalPlaces"
		| "ratioMaxDecimalPlaces"
		| "ratioPrefix"
		| "ratioSuffix"
	>
): { [key: string]: string } {
	const valFmt: FormatConfig = {
		unitPrefix: config.valueUnitPrefix,
		digitGrouping: config.valueDigitGrouping,
		minDecimalPlaces: config.valueMinDecimalPlaces,
		maxDecimalPlaces: config.valueMaxDecimalPlaces,
		prefix: config.valuePrefix,
		suffix: config.valueSuffix
	}

	const pctFmt: FormatConfig = {
		digitGrouping: config.pctDigitGrouping,
		minDecimalPlaces: config.pctMinDecimalPlaces,
		maxDecimalPlaces: config.pctMaxDecimalPlaces,
		prefix: config.pctPrefix,
		suffix: config.pctSuffix
	}

	const ratioFmt: FormatConfig = {
		digitGrouping: config.ratioDigitGrouping,
		minDecimalPlaces: config.ratioMinDecimalPlaces,
		maxDecimalPlaces: config.ratioMaxDecimalPlaces,
		prefix: config.ratioPrefix,
		suffix: config.ratioSuffix
	}

	return {
		value: formatValue(computed.value, valFmt),
		reference: formatValue(computed.reference, valFmt),
		difference: formatValue(computed.difference, valFmt),
		absoluteDifference: formatValue(computed.absoluteDifference, valFmt),
		percentage: formatValue(computed.percentage, pctFmt),
		percentChange: formatValue(computed.percentChange, pctFmt),
		ratio: formatValue(computed.ratio, ratioFmt),
		ratioChange: formatValue(computed.ratioChange, ratioFmt)
	}
}

// ── SQL expression helper ─────────────────────────────────────────────────────

/**
 * Merge two WHERE clauses with AND.
 * "1=1" is treated as "no filter" and is omitted from the result.
 */
export function mergeWhereClauses(a: string, b: string): string {
	const cleanA = !a || a === "1=1" ? "" : a
	const cleanB = !b || b === "1=1" ? "" : b
	if (!cleanA && !cleanB) return "1=1"
	if (!cleanA) return cleanB
	if (!cleanB) return cleanA
	return `(${cleanA}) AND (${cleanB})`
}
