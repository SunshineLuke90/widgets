import type { ImmutableObject } from "seamless-immutable"

export interface Config {
	rangeType: "NUMBER" | "DATE" | "DATE_ONLY" | "TIME_ONLY"
	minValue: number | Date
	maxValue: number | Date
	minLabel: string
	maxLabel: string
	minLabelPosition: "TOP" | "BOTTOM"
	maxLabelPosition: "TOP" | "BOTTOM"
	startColor: string
	endColor: string
	showTicks: boolean
	showCurrentValue: boolean
	tickInterval?: number
	tickDateInterval?: "DAY" | "MONTH" | "YEAR" | "HOUR" | "MINUTE"
}

export type IMConfig = ImmutableObject<Config>
