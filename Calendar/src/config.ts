import type { ImmutableObject } from "seamless-immutable"

export interface colorset {
	id: string
	fieldValue: string
	color: string
}

export interface data {
	id: string
	dataSourceId?: string

	labelField?: string
	startDateField?: string
	endDateField?: string
	allDayField?: string
	descriptionField?: string
	colorsetField?: string

	defaultEventColor?: string
	colorsets?: colorset[]
}

export interface Config {
	dataSets: data[]
	maxEventCount: number
}

export type IMConfig = ImmutableObject<Config>
