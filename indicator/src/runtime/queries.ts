import {
	dataSourceUtils,
	type StatisticDefinition,
	type QueryScope,
	type ArcGISQueriableDataSource,
	type ArcGISQueryParams
} from "jimu-core"

const { QueryScope: QScope } = require("jimu-core") as {
	QueryScope: { [key: string]: string }
}

// ── SQL expression helper ─────────────────────────────────────────────────────

export function getConfigWhere (
	ds: ArcGISQueriableDataSource,
	expr: any
): string {
	if (!expr) return "1=1"
	try {
		return dataSourceUtils.getArcGISSQL(expr, ds as any)?.sql || "1=1"
	} catch {
		return "1=1"
	}
}

// ── Statistic query ───────────────────────────────────────────────────────────

export async function queryStatValue (
	ds: ArcGISQueriableDataSource,
	field: string | undefined,
	statisticType: string,
	configWhere: string
): Promise<number | null> {
	try {
		const opts = { scope: QScope.InRuntimeView as QueryScope }
		if (statisticType === "count") {
			const result = await ds.queryCount(
				{ where: configWhere } as ArcGISQueryParams,
				opts
			)
			return (result as any).count ?? null
		}
		if (!field) return null
		const result = await ds.query(
			{
				where: configWhere,
				outStatistics: [
					{
						statisticType,
						onStatisticField: field,
						outStatisticFieldName: "result"
					} as StatisticDefinition
				]
			} as ArcGISQueryParams,
			opts
		)
		const records = (result as any).records ?? []
		if (records.length > 0) {
			const data: { [key: string]: any } = records[0].getData?.() ?? {}
			const val = data.result ?? Object.values(data)[0]
			return typeof val === "number" ? val : null
		}
		return null
	} catch (err) {
		console.warn("Indicator: stats query failed", err)
		return null
	}
}

// ── Feature query (one or more fields) ────────────────────────────────────────

/**
 * Query all features matching `configWhere` and extract numeric values for
 * each field in `fields`.  Returns a record keyed by field name, each entry
 * holding an ordered array of per-feature values.
 *
 * Works for a single field or multiple fields in one query.
 */
export async function queryFeatureFieldValues (
	ds: ArcGISQueriableDataSource,
	fields: string[],
	configWhere: string
): Promise<{ [key: string]: Array<number | null> }> {
	const uniqueFields = [...new Set(fields)]
	const result: { [key: string]: Array<number | null> } = {}
	for (const f of uniqueFields) {
		result[f] = []
	}

	try {
		const opts = { scope: QScope.InRuntimeView as QueryScope }
		const queryResult = await ds.query(
			{ where: configWhere, outFields: uniqueFields } as ArcGISQueryParams,
			opts
		)
		const records = (queryResult as any).records ?? []
		for (const record of records) {
			const data = record.getData?.() ?? {}
			for (const f of uniqueFields) {
				const val = data[f]
				result[f].push(typeof val === "number" ? val : null)
			}
		}
	} catch (err) {
		console.warn("Indicator: feature query failed", err)
	}

	return result
}
