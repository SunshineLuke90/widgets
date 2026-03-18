import type { IconResult, IMSqlExpression } from "jimu-core"
import type { ImmutableObject } from "seamless-immutable"

export type IndicatorType = "Statistic" | "Feature"
export type ReferenceType =
	| "none"
	| "Statistic"
	| "Feature"
	| "FixedValue"
	| "PreviousValue"
export type StatisticType = "count" | "sum" | "avg" | "min" | "max"
export type FontSize =
	| "xx-small"
	| "x-small"
	| "small"
	| "medium"
	| "large"
	| "x-large"
	| "xx-large"

export interface Config {
	icon?: IconResult
	indQuery: IMSqlExpression
	refQuery: IMSqlExpression
	indField: string
	indType: IndicatorType
	mainStatisticType: StatisticType

	refField?: string
	refType: ReferenceType
	refStatisticType: StatisticType
	refFixedValue?: number

	infoText: string

	topText: string
	topTextColor: string
	topTextMaxSize: FontSize
	middleText: string
	middleTextColor: string
	middleTextMaxSize: FontSize
	bottomText: string
	bottomTextColor: string
	bottomTextMaxSize: FontSize

	valueStyle: "Decimal" | "Percentage"
	valueDigitGrouping: boolean
	valueMinDecimalPlaces?: number
	valueMaxDecimalPlaces?: number
	valuePrefix: string
	valueSuffix: string
	valueUnitPrefix: boolean

	pctDigitGrouping: boolean
	pctMinDecimalPlaces?: number
	pctMaxDecimalPlaces?: number
	pctPrefix: string
	pctSuffix: string

	ratioDigitGrouping: boolean
	ratioMinDecimalPlaces?: number
	ratioMaxDecimalPlaces?: number
	ratioPrefix: string
	ratioSuffix: string

	showLastUpdateTime: boolean
	lastUpdateTimeTextColor: string
}

export type IMConfig = ImmutableObject<Config>
