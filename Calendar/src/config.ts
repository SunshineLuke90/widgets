import type { ImmutableObject } from "seamless-immutable"

export type CalendarView = "dayGridWeek" | "dayGridMonth" | "3day" | "timeGridDay" | "timeGridWeek" | "listDay" | "listWeek" | "listMonth"

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
	initialView: CalendarView
	optionalViews: CalendarView[]
	defaultFilterState: boolean
	initialDate?: Date | string | number
}

export type IMConfig = ImmutableObject<Config>
