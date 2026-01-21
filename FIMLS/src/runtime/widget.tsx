import { React, jsx } from 'jimu-core'
import { useState } from 'react'
import { type AllWidgetProps, type DataSource, DataSourceComponent, type FeatureLayerQueryParams, type IMDataSourceInfo, type DataRecord } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { IMConfig } from '../config'
import defaultMessages from './translations/default'
import './style.css'
import { CalciteSlider } from '@esri/calcite-components-react'
import FeatureLayer from 'esri/layers/FeatureLayer'
import { createPortal } from 'react-dom'


export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config, useMapWidgetIds } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const [layerVis, setLayerVis] = useState(false)
  const [numLayer, setNumLayer] = useState(0)
  const [activeName, setActiveName] = useState("")
  let toggleArr = []
  let toggleLayers = []
  const [activeLayerIds, setActiveLayerIds] = useState([])

  let timer

  const isConfigured = useMapWidgetIds?.length > 0

  const handleViewChange = (fullList: string[], activeLayer: string) => {
    if (!jimuMapView || !jimuMapView.view) return

    // Define function to return a layer from a given layerid. This gets used further down.
    const findLayerById = (layerId: string) => {
      return jimuMapView.view.map.allLayers.find(l => l.id === layerId)
    }

    // Turn all layers in the list off, then turn the active layer on.
    fullList.forEach(layerId => {
      const layer = findLayerById(layerId)
      if (layer) {
        layer.visible = false
      }
    })

    // Turn on "active" layer
    findLayerById(activeLayer).visible = true
  }

  const handleFIMChange = (selectedRecords: DataRecord[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (activeName !== "" && activeName === selectedRecords[0].getFieldValue(config.nameField)) {
        console.debug("Same feature selected. Do nothing.")
        return null
      }
      setLayerVis(true)
      setActiveName(selectedRecords[0].getFieldValue(config.nameField))
      toggleArr = selectedRecords[0].getFieldValue(config.toggleItemUrlArrayField).split(',')
      setNumLayer(toggleArr.length)
      const layers = []
      const layerIds = []

      toggleArr.forEach((item, idx) => {
        layers.push(
          new FeatureLayer({
            url: selectedRecords[0].getFieldValue(config.toggleBaseUrlField) + "/" + item,
            id: "sixseven" + idx,
            visible: false
          })
        )
        layerIds.push("sixseven" + idx)
      })

      setActiveLayerIds(layerIds)
      toggleLayers = layers
      jimuMapView.view.map.addMany(toggleLayers)
      handleViewChange(activeLayerIds, "sixseven0")
    }, 1000)
  }

  const handleFIMClose = () => {

    const findLayerById = (layerId: string) => {
      return jimuMapView.view.map.allLayers.find(l => l.id === layerId)
    }

    activeLayerIds.forEach(layerId => {
      const layer = findLayerById(layerId)
      jimuMapView.view.map.remove(layer)
    })
    setNumLayer(0)
    setActiveName("")
    setActiveLayerIds([])
    setLayerVis(false)
  }

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
    if (selectedRecords.length <= 0) {
      return null
    }
    handleFIMChange(selectedRecords)
  }

  const sliderPortal = (layerVis && activeName) ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: 400,
        top: 400,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        padding: 4,
        userSelect: 'none',
        minWidth: 200,
        minHeight: 68
      }}
    >
      <div
        className="video-close-btn"
        style={{
          position: 'absolute',
          top: 2,
          right: 6,
          fontSize: 18,
          color: '#fff',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 2
        }}
        onClick={() => { handleFIMClose() }}
        title="Close"
      >×</div>
      <CalciteSlider
        max={numLayer - 1}
        snap
        ticks={1}
        calcite-hydrated
        style={{ width: '90%', marginLeft: 'auto', marginRight: 'auto', marginTop: 30 }}
        onCalciteSliderInput={
          (e) => { handleViewChange(activeLayerIds, ("sixseven" + e.target.value)) }
        }
      />
    </div>,
    document.body
  ) : null

  return (
    <>
      <div className="widget-abls jimu-widget">
        {useMapWidgetIds?.length > 0 && (
          <JimuMapViewComponent
            useMapWidgetId={useMapWidgetIds?.[0]}
            onActiveViewChange={(jmv) => { setJimuMapView(jmv) }}
          />
        )}
        <DataSourceComponent useDataSource={props.useDataSources[0]} query={{ where: '1=1' } as FeatureLayerQueryParams} widgetId={props.id}>
          {dataRender}
        </DataSourceComponent>
      </div>
      {sliderPortal}
    </>
  )
}
