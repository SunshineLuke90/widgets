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
	iconPosition?: "left" | "right"
	indQuery: IMSqlExpression
	refQuery: IMSqlExpression
	indType: IndicatorType
	mainStatisticType: StatisticType
	conditionalFormat: boolean

	refType: ReferenceType
	refStatisticType: StatisticType
	refFixedValue?: number

	topText: string
	topTextColor: string
	topTextMaxSize: FontSize
	middleText: string
	middleTextColor: string
	middleTextMaxSize: FontSize
	bottomText: string
	bottomTextColor: string
	bottomTextMaxSize: FontSize
	icon?: IconResult

	topTextBelow: string
	topTextColorBelow: string
	topTextMaxSizeBelow: FontSize
	middleTextBelow: string
	middleTextColorBelow: string
	middleTextMaxSizeBelow: FontSize
	bottomTextBelow: string
	bottomTextColorBelow: string
	bottomTextMaxSizeBelow: FontSize
	iconBelow?: IconResult

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

	refreshIntervalValue: number
	refreshIntervalUnit: "seconds" | "minutes" | "hours"
}

export type IMConfig = ImmutableObject<Config>
