import { React, jsx } from 'jimu-core'
//import { lazy } from 'react'
import { type AllWidgetProps, DataSource, DataSourceComponent, FeatureLayerQueryParams, IMDataSourceInfo, DataSourceStatus } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { IMConfig } from '../config'
import { Icon } from 'jimu-ui'
import defaultMessages from './translations/default'
import './style.css'
import { CalciteSlider } from '@esri/calcite-components-react';
import TimeExtent from '@arcgis/core/time/TimeExtent'
import FeatureLayer from 'esri/layers/FeatureLayer'

export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config, useDataSources, useMapWidgetIds } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const [activeViewId, setActiveViewId] = React.useState<string>(null)

  const isConfigured = useMapWidgetIds?.length > 0

  /*
    const handleViewChange = (view: ABLSView) => {
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
      if (view.timeEnabled) {
        const startOffset = view.startOffset ?? 0
        const endOffset = view.endOffset ?? 0
  
        //Calculate the start date
        const startDate = new Date()
        startDate.setDate(startDate.getDate() + startOffset)
        startDate.setHours(0, 0, 0, 0) // set time to very beginning of day
  
        //Calculate the end date
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + endOffset)
        endDate.setHours(23, 59, 59, 999) // set time to very end of day
  
        // If time is enabled for this view, apply the time extent
        jimuMapView.view.timeExtent = new TimeExtent({
          start: startDate,
          end: endDate
        })
  
      } else {
        // Otherwise, clear the map's time extent
        jimuMapView.view.timeExtent = null
      }
    }
  
    React.useEffect(() => {
      // Check if the map is loaded, if views are configured, and if no view is active yet.
      if (jimuMapView && !activeViewId) {
        // Trigger the handler for the first view in the configuration.
        handleViewChange()
      }
    }, [jimuMapView, activeViewId]) // Dependencies for the effect
  */
  if (!isConfigured) {
    return (
      <div className="widget-abls text-center">
        <h3>Flood Inundation Map Layer Switcher</h3>
        <p>{props.intl.formatMessage({ id: 'configureWidget', defaultMessage: defaultMessages.configureWidget })}</p>
      </div>
    )
  }

  const dataRender = (ds: DataSource, info: IMDataSourceInfo) => {
    const selectedRecords = ds.getSelectedRecords()
    if (selectedRecords.length > 0) {
      const toggleArr = selectedRecords[0].getFieldValue(config.toggleItemUrlArrayField).split(',')
      console.log(toggleArr)
      const layers = []
      for (var x in toggleArr) {
        layers.push(
          new FeatureLayer({
            url: selectedRecords[0].getFieldValue(config.toggleBaseUrlField) + "/" + toggleArr[x]
          })
        )
      }
      jimuMapView.view.map.addMany(layers)
      console.log(layers)
    }
    return null
  }

  return (
    <div className="widget-abls jimu-widget">
      {useMapWidgetIds?.length > 0 && (
        <JimuMapViewComponent
          useMapWidgetId={useMapWidgetIds?.[0]}
          onActiveViewChange={(jmv) => { setJimuMapView(jmv) }}
        />
      )}
      <CalciteSlider
        max={4}
        snap
        status="idle"
        ticks={1}
        calcite-hydrated
        style={{ width: '90%', marginLeft: 'auto', marginRight: 'auto' }}
      //onCalciteSliderInput={
      //  (e) => { handleViewChange(config.views[e.target.value as number]) }
      //}
      />
      <DataSourceComponent useDataSource={props.useDataSources[0]} query={{ where: '1=1' } as FeatureLayerQueryParams} widgetId={props.id}>
        {dataRender}
      </DataSourceComponent>
    </div>
  )
}
