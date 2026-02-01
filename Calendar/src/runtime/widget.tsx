import {
	React,
	type AllWidgetProps,
	type DataSource,
	DataSourceComponent,
	type FeatureLayerQueryParams,
	DataSourceStatus,
	MessageManager,
	DataRecordsSelectionChangeMessage
} from "jimu-core"
import type { data, IMConfig } from "../config"
import "./style.css"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import timeGridPlugin from "@fullcalendar/timegrid"
import { cssVar } from "polished"

export default function Widget(props: AllWidgetProps<IMConfig>) {
	const { config } = props
	//const [ds, setDs] = React.useState<DataSource>(null)
	const [datasources, setDatasources] = React.useState<DataSource[]>([])
	// Store events keyed by datasource ID to support multiple datasources
	const [eventsByDsId, setEventsByDsId] = React.useState<{
		[dsId: string]: any[]
	}>({})

	// Compute flat events array from all datasources
	const events = Object.values(eventsByDsId).flat()

	const isConfigured =
		config.dataSets &&
		config.dataSets.length > 0 &&
		config.dataSets[0].useDataSources &&
		config.dataSets[0].useDataSources.length === 1 &&
		config.dataSets[0].startDateField &&
		config.dataSets[0].endDateField

	const fillCalendarEvents = (ds: DataSource, dsConfig: data) => {
		if (!ds) return
		try {
			const dsId = ds.id
			const records = ds.getRecords() || []
			const currentEventsForDs = eventsByDsId[dsId] || []

			// Only update if record count changed to avoid unnecessary state updates
			if (records.length === currentEventsForDs.length) return

			const loadedEvents = records.map((record) => {
				const title = record.getFieldValue(dsConfig.labelField) as string
				const rawStart = record.getFieldValue(dsConfig.startDateField)
				const rawEnd = record.getFieldValue(dsConfig.endDateField)
				const rawAllDay = record.getFieldValue(dsConfig.allDayField) as string
				const description = record.getFieldValue(
					dsConfig.descriptionField
				) as string
				const colorFieldValue = record.getFieldValue(
					dsConfig.colorsetField
				) as string

				let start: string, end: string, color: string | number

				const toISO = (v: any) => {
					if (v == null) return undefined
					const d = v instanceof Date ? v : new Date(v)
					return isNaN(d.getTime()) ? undefined : d.toISOString()
				}
				const toISODateOnly = (v: any) => {
					if (v == null) return undefined
					const d = v instanceof Date ? v : new Date(v)
					d.setHours(d.getHours() - d.getTimezoneOffset() / 60) // Adjust to local date
					return isNaN(d.getTime()) ? undefined : d.toISOString().split("T")[0]
				}

				if (rawAllDay === "y") {
					start = toISODateOnly(rawStart)
				} else {
					start = toISO(rawStart)
					end = toISO(rawEnd)
				}

				if (dsConfig.colorsets && colorFieldValue) {
					const matchedColorSet = dsConfig.colorsets.find(
						(cs) => cs.fieldValue === colorFieldValue
					)
					if (matchedColorSet) {
						color = matchedColorSet.color
					} else {
						color =
							dsConfig.defaultEventColor ||
							cssVar("--ref-palette-secondary-500")
					}
				} else {
					color =
						dsConfig.defaultEventColor || cssVar("--ref-palette-secondary-500")
				}

				return {
					id: `${dsId}_${record.getId()}`, // Prefix with dsId to ensure unique IDs across datasources
					originalId: record.getId(),
					dataSource: ds,
					title: title ?? "",
					start: start,
					end: end ?? undefined,
					color: color,
					description: description ?? ""
				}
			})

			// Update only this datasource's events, preserving others
			setEventsByDsId((prev) => ({
				...prev,
				[dsId]: loadedEvents
			}))
		} catch (e) {
			console.error("Failed to load events from datasource", e)
		}
	}

	const getRecordById = (ds: DataSource, objectId: string) => {
		if (ds) {
			return ds.getRecordById(objectId)
		}
		return null
	}

	const selectFeature = (ds: DataSource, objectId: string) => {
		if (ds && ds.selectRecordsByIds) {
			ds.selectRecordsByIds([objectId]) // This updates the selection state
		}
	}

	const handleEventClick = (clickInfo) => {
		const eventDs = clickInfo.event.extendedProps.dataSource
		const originalId = clickInfo.event.extendedProps.originalId
		selectFeature(eventDs, originalId)
		const record = getRecordById(eventDs, originalId)
		const message = new DataRecordsSelectionChangeMessage(
			props.widgetId,
			[record],
			[eventDs.id]
		)
		MessageManager.getInstance().publishMessage(message)
	}

	const handleClearSelection = () => {
		/// Loop through all datasets, if there is a selection, clear it and post a message.
		datasources.forEach((ds) => {
			if (ds.getSelectedRecords().length > 0) {
				ds.clearSelection()
				const message = new DataRecordsSelectionChangeMessage(
					props.widgetId,
					[],
					[props.useDataSources[0].dataSourceId]
				)
				MessageManager.getInstance().publishMessage(message)
			}
		})
	}

	if (!isConfigured) {
		return (
			<div className="widget-calendar-not-configured">
				Please configure the Calendar widget in the settings panel.
			</div>
		)
	}
	//return <div>Calendar widget has been configured.</div>

	const addDatasource = (ds: DataSource) => {
		setDatasources((prevDatasources) => {
			// Avoid adding duplicates
			if (!prevDatasources.includes(ds)) {
				return [...prevDatasources, ds]
			}
			return prevDatasources
		})
	}

	return (
		<>
			<FullCalendar
				plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
				initialView="dayGridMonth"
				events={events}
				eventClick={handleEventClick}
				eventDidMount={(info) => {
					// Tooltip showing full date/time info
					const description = info.event.extendedProps.description
					const start = info.event.start
					const end = info.event.end
					let tooltipText = description + "\nStart: " + start.toLocaleString()
					if (end) {
						tooltipText += "\nEnd: " + end.toLocaleString()
					}
					info.el.setAttribute("title", tooltipText)
				}}
				customButtons={{
					clearSelection: {
						text: "Clear Selection",
						click: () => {
							/*
								ds.clearSelection()
								console.debug("Cleared selection in datasource")
								const message = new DataRecordsSelectionChangeMessage(
									props.widgetId,
									[],
									[props.useDataSources[0].dataSourceId]
								)
								MessageManager.getInstance().publishMessage(message)
								*/
							handleClearSelection()
						}
					}
				}}
				buttonText={{
					today: "Today",
					month: "Month",
					week: "Week",
					day: "Day"
				}}
				headerToolbar={{
					left: "prev,next today clearSelection",
					center: "title",
					right: "dayGridMonth,timeGridWeek,timeGridDay"
				}}
			/>
			{config.dataSets && config.dataSets.length > 0 && (
				<>
					{config.dataSets.map((dsConfig, index) => (
						<DataSourceComponent
							key={index}
							useDataSource={dsConfig.useDataSources[0]}
							query={
								{
									where: "1=1",
									outFields: ["*"],
									returnGeometry: true
								} as FeatureLayerQueryParams
							}
							widgetId={props.widgetId}
						>
							{(ds: DataSource) => {
								if (ds && ds.getStatus() === DataSourceStatus.Loaded) {
									// Data source is loaded — populate calendar events
									addDatasource(ds)
									fillCalendarEvents(ds, dsConfig.asMutable({ deep: true }))
								}
								return null
							}}
						</DataSourceComponent>
					))}
				</>
			)}
		</>
	)
}
