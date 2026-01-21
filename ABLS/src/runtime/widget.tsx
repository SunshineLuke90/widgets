import { React, jsx } from 'jimu-core'
//import { lazy } from 'react'
import type { AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { Config, ABLSView } from '../config'
import { Icon } from 'jimu-ui'
import defaultMessages from './translations/default'
import './style.css'
import TimeExtent from '@arcgis/core/time/TimeExtent'
import { useCallback } from 'react'

export default function Widget(props: AllWidgetProps<Config>) {
  const { config, useMapWidgetIds } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const [activeViewId, setActiveViewId] = React.useState<string>(null)

  // This is the way that the widget prevents itself from running itself, and from crashing. It checks to see if any maps have been selected, and if any views have been configured.
  const isConfigured = useMapWidgetIds?.length > 0 && config.views?.length > 0

  // The contained elements are performed every time a view button is clicked.
  const handleViewChange = useCallback((view: ABLSView) => {
    if (!jimuMapView || !jimuMapView.view) return

    setActiveViewId(view.id)

    // 1. Handle Layer Visibility
    const findLayerById = (layerId: string) => {
      return jimuMapView.view.map.allLayers.find(l => l.id === layerId)
    }

    // First, turn all layers off (or handle as needed)
    // For simplicity, we only manage layers defined in our views.
    // A better approach might be to turn ALL layers off first, then turn on the selected ones.
    jimuMapView.view.map.allLayers.forEach(layer => {
      layer.visible = false
    })

    // Now, turn on the layers specified in the selected view
    view.layerIds.forEach(layerId => {
      const layer = findLayerById(layerId)
      if (layer) {
        layer.visible = true
      }
    })


    // Apply a time offset, if the enable time offest is selected.
    if (view.timeEnabled) {
      const startOffset = view.startOffset ?? 0
      const endOffset = view.endOffset ?? 0

      //Calculate the start date
      const startDate = new Date()
      const endDate = new Date()

      startDate.setDate(startDate.getDate() + startOffset)

      if (view.timeRange) {
        startDate.setHours(0, 0, 0, 0) // set start time to very beginning of day
        //Calculate the end date
        endDate.setDate(endDate.getDate() + endOffset)
        endDate.setHours(23, 59, 59, 999) // set end time to very end of day
      }
      else {
        startDate.setHours(view.tod, 0, 0, 0)
        //Calculate the end date
        endDate.setTime(startDate.getTime())
      }

      // If time is enabled for this view, apply the time extent
      jimuMapView.view.timeExtent = new TimeExtent({
        start: startDate,
        end: endDate
      })

    } else {
      // Otherwise, clear the map's time extent
      jimuMapView.view.timeExtent = null
    }
  }, [jimuMapView])

  React.useEffect(() => {
    // Check if the map is loaded, if views are configured, and if no view is active yet.
    if (jimuMapView && !activeViewId && config.views?.length > 0) {
      // Trigger the handler for the first view in the configuration.
      handleViewChange(config.views[0])
    }
  }, [handleViewChange, jimuMapView, activeViewId, config.views]) // Dependencies for the view change to occur.


  // A default display to show when the settings panel has not been completely configured. This is required so that the widget logic doesn't crash while the widget is being set up.
  if (!isConfigured) {
    return (
      <div className="widget-abls text-center">
        <h3>A Better Layer Switcher</h3>
        <p>{props.intl.formatMessage({ id: 'configureWidget', defaultMessage: defaultMessages.configureWidget })}</p>
      </div>
    )
  }

  // This return statement will not be run unless the widget has been set up at least to some degree. This is what actually creates the UI for the widget that is visible to the end user
  return (
    // Outer Div for the entire widget
    <div className="widget-abls jimu-widget">
      {useMapWidgetIds?.length > 0 && (
        // Set a link to the map, so that when the views change, the layers on the map will actually change.
        <JimuMapViewComponent
          useMapWidgetId={useMapWidgetIds?.[0]}
          onActiveViewChange={(jmv) => { setJimuMapView(jmv) }}
        />
      )}
      <div className="view-buttons-container">
        {config.views.map(view => ( //The .map function creates the contained items multiple times, one button for each view in this case.
          <calcite-button
            key={view.id}
            className={`view-button ${activeViewId === view.id ? 'active' : ''}`}
            title={view.name}
            round={true}
            onClick={() => { handleViewChange(view) }}
            appearance={activeViewId === view.id ? 'solid' : 'transparent'}
            kind={activeViewId === view.id ? 'brand' : 'neutral'}
          >
            {view.icon && <Icon icon={view.icon.svg} size="16" className="mr-2" />}
            {view.name}
          </calcite-button>
        ))}
      </div>
    </div>
  )
}
