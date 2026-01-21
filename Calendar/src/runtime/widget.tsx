import { type AllWidgetProps, type DataSource, DataSourceComponent, type FeatureLayerQueryParams, DataSourceStatus, MessageManager, DataRecordsSelectionChangeMessage } from 'jimu-core'
import type { IMConfig } from '../config'
import './style.css'
import { useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import { cssVar } from 'polished'

export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config } = props

  const [ds, setDs] = useState<DataSource>(null)
  const [events, setEvents] = useState<any[]>([])

  const fillCalendarEvents = (ds: DataSource) => {
    if (!ds) return
    try {
      const records = ds.getRecords() || []
      // Only update if record count changed to avoid unnecessary state updates
      if (records.length === events.length) return

      const loadedEvents = records.map(record => {
        const title = record.getFieldValue(config.labelField) as string
        const rawStart = record.getFieldValue(config.startDateField)
        const rawEnd = record.getFieldValue(config.endDateField)
        const rawAllDay = record.getFieldValue(config.allDayField) as string
        const description = record.getFieldValue(config.descriptionField) as string
        const colorFieldValue = record.getFieldValue(config.colorsetField) as string

        let start: string, end: string, color: string | number

        const toISO = (v: any) => {
          if (v == null) return undefined
          const d = (v instanceof Date) ? v : new Date(v)
          return isNaN(d.getTime()) ? undefined : d.toISOString()
        }
        const toISODateOnly = (v: any) => {
          if (v == null) return undefined
          const d = (v instanceof Date) ? v : new Date(v)
          d.setHours(d.getHours()-d.getTimezoneOffset()/60) // Adjust to local date
          return isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0]
        }

        if (rawAllDay === 'y') {
          start = toISODateOnly(rawStart)
        }
        else {
          start = toISO(rawStart)
          end = toISO(rawEnd)
        }

        if (config.colorsets && colorFieldValue) {
          const matchedColorSet = config.colorsets.find(cs => cs.fieldValue === colorFieldValue)
          if (matchedColorSet) {
            color = matchedColorSet.color
          }
          else {
            color = config.defaultEventColor || cssVar('--ref-palette-secondary-500')
          }
        }
        else {
          color = config.defaultEventColor || cssVar('--ref-palette-secondary-500')
        }

        return {
          id: record.getId(),
          title: title ?? '',
          start: start,
          end: end ?? undefined,
          color: color,
          description: description ?? ''
        }
      })
      setEvents(loadedEvents)
    } catch (e) {
      console.error('Failed to load events from datasource', e)
    }
  }

  const getRecordById = (objectId: string) => {
    if (ds) {
      return ds.getRecordById(objectId)
    }
    return null
  }

  const selectFeature = (objectId: string) => {
    if (ds && ds.selectRecordsByIds) {
      ds.selectRecordsByIds([objectId]) // This updates the selection state
    }
  }

  const handleEventClick = (clickInfo) => {
    selectFeature(clickInfo.event.id)
    const record = getRecordById(clickInfo.event.id)
    const message = new DataRecordsSelectionChangeMessage(props.widgetId, [record], [props.useDataSources[0].dataSourceId])
    MessageManager.getInstance().publishMessage(message)
  }

  return (
    <>
      <FullCalendar
        plugins={[ timeGridPlugin, dayGridPlugin, interactionPlugin ]}
        initialView='dayGridMonth'
        events={events}
        eventClick={handleEventClick}
        eventDidMount={(info) => {
          // Tooltip showing full date/time info
          const description = info.event.extendedProps.description
          const start = info.event.start
          const end = info.event.end
          let tooltipText = description + '\nStart: ' + start.toLocaleString()
          if (end) {
            tooltipText += '\nEnd: ' + end.toLocaleString()
          }
          info.el.setAttribute('title', tooltipText)
        }}
        customButtons={{
          clearSelection:{
            text: 'Clear Selection',
            click: () => {
              if (ds && ds.clearSelection) {
                ds.clearSelection()
                console.debug('Cleared selection in datasource')
                const message = new DataRecordsSelectionChangeMessage(props.widgetId, [], [props.useDataSources[0].dataSourceId])
                MessageManager.getInstance().publishMessage(message)
              }
            }
          }
        }}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day'
        }}
        headerToolbar={{
          left: 'prev,next today clearSelection',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
      />
      <DataSourceComponent useDataSource={props.useDataSources[0]} query={{ where: '1=1', outFields: ['*'], returnGeometry: true } as FeatureLayerQueryParams} widgetId={props.widgetId}>
        {
          (ds: DataSource) => {
            if (ds && ds.getStatus() === DataSourceStatus.Loaded) {
              // Data source is loaded — populate calendar events
              setDs(ds)
              fillCalendarEvents(ds)
            }
            return null
          }
        }
      </DataSourceComponent>
    </>
  )
}
