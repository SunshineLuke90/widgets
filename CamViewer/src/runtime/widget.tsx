import { React, type AllWidgetProps, jsx, DataSource, DataSourceComponent, FeatureLayerQueryParams, IMDataSourceInfo, DataSourceStatus } from 'jimu-core'
import type { IMConfig } from '../config'
import { DataSourceManager } from 'jimu-core'
import defaultMessages from './translations/default'
import { JimuMapViewComponent, JimuMapView, JimuLayerView, JimuLayerViews, JimuLayerViewComponent } from 'jimu-arcgis'
import { Button, Icon } from 'jimu-ui'
import './style.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import classNames from 'classnames'

// You need to install hls.js into your client directory
// Run npm install hls.js in your client directory to install.
import Hls from 'hls.js'

export default function Widget(props: AllWidgetProps<IMConfig>) {
  const { config, useDataSources, useMapWidgetIds } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const videoRef = useRef()

  const isConfigured = useDataSources && useDataSources.length > 0 && useDataSources[0].dataSourceId && useDataSources[0].fields && useDataSources[0].fields.length > 0

  // If not configured, show a message
  if (!isConfigured) {
    return (
      <div className="widget-camviewer jimu-widget">
        <div className="widget-camviewer-not-configured">
          {defaultMessages.notConfigured}
        </div>
      </div>
    )
  }

  // Dedicated state for currentURL and layerView
  const [currentURL, setCurrentURL] = React.useState<string | undefined>(undefined)
  const [layerView, setLayerView] = React.useState<JimuLayerView | undefined>(undefined)
  const [camLayerOn, setCamLayerOn] = React.useState(false)

  // State for video position and size
  const [videoPos, setVideoPos] = useState({ x: 100, y: 100 })
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizing, setResizing] = useState(false)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 250, height: 140 })
  const [videoSize, setVideoSize] = useState({ width: 250, height: 140 })
  const [showVideo, setShowVideo] = useState(true)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)

  const dataRender = (ds: DataSource, info: IMDataSourceInfo) => {
    const selectedRecords = ds.getSelectedRecords()
    const fieldanme = props.useDataSources[0].fields[0]
    if (selectedRecords.length > 0) {
      const url = selectedRecords[0].getFieldValue(fieldanme)
      setCurrentURL(url)
      setShowVideo(true)
    }
    return null
  }

  // Draggable, resizable, closable video portal
  const handleMouseMove = (e) => {
    if (dragging) {
      setVideoPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
    } else if (resizing) {
      const dx = e.clientX - resizeStart.x
      let newWidth = Math.max(120, resizeStart.width + dx)
      let newHeight = Math.round(newWidth / aspectRatio)
      setVideoSize({ width: newWidth, height: newHeight })
    }
  }
  const handleMouseUp = () => {
    setDragging(false)
    setResizing(false)
  }
  React.useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  })

  const videoPortal = (currentURL && showVideo) ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: videoPos.x,
        top: videoPos.y,
        zIndex: 9999,
        cursor: dragging ? 'grabbing' : 'grab',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        padding: 4,
        userSelect: 'none',
        minWidth: 120,
        minHeight: 68
      }}
      onMouseDown={e => {
        // Only drag if not clicking close or resize
        if ((e.target as HTMLElement).classList.contains('video-close-btn') || (e.target as HTMLElement).classList.contains('video-resize-handle')) return
        setDragging(true)
        setDragOffset({ x: e.clientX - videoPos.x, y: e.clientY - videoPos.y })
      }}
    >
      {/* Close button */}
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
        onClick={() => setShowVideo(false)}
        title="Close"
      >×</div>
      {/* Video */}
      <video
        ref={videoRef}
        src={currentURL}
        autoPlay={true}
        style={{ width: videoSize.width, height: videoSize.height, borderRadius: 10, display: 'block' }}
        className={'cameraViewer-video'}
        onLoadedMetadata={e => {
          const video = e.currentTarget
          if (video.videoWidth && video.videoHeight) {
            const ratio = video.videoWidth / video.videoHeight
            setAspectRatio(ratio)
            // Optionally, update window size to match new aspect ratio
            setVideoSize(prev => ({ width: prev.width, height: Math.round(prev.width / ratio) }))
          }
        }}
      />
      {/* Resize handle */}
      <div
        className="video-resize-handle"
        style={{
          position: 'absolute',
          right: 2,
          bottom: 2,
          width: 18,
          height: 18,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 4,
          cursor: 'nwse-resize',
          zIndex: 2,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
        onMouseDown={e => {
          e.stopPropagation()
          setResizing(true)
          setResizeStart({ x: e.clientX, y: e.clientY, width: videoSize.width, height: videoSize.height })
        }}
        title="Resize"
      >
        <svg width="16" height="16" viewBox="0 0 16 16"><polyline points="4,16 16,4" stroke="#fff" strokeWidth="2" fill="none"/></svg>
      </div>
    </div>,
    document.body
  ) : null

  const activeViewChangeHandler = (jmv: JimuMapView): void => {
    if (jmv) {
      setJimuMapView(jmv)
    }
  }

  const toggleLayerVisibility = useCallback(() => {
    if (!jimuMapView || !props.useDataSources?.[0] || !layerView) {
      console.warn('Map view, data source, or layerView is not ready.')
      return
    }
    const newVal = !camLayerOn
    setCamLayerOn(newVal)
    layerView.view.set({ visible: newVal })
    console.log('Layer visibility toggled:', newVal)
  }, [jimuMapView, props.useDataSources, layerView, camLayerOn])

  React.useEffect(() => {
    if (jimuMapView && props.useDataSources?.length > 0 && !layerView) {
      const jimuLayerView = jimuMapView.getJimuLayerViewByDataSourceId(props.useDataSources[0].dataSourceId)
      if (!jimuLayerView) {
        console.warn('Cannot find layer view.')
        return
      }
      setLayerView(jimuLayerView)
      setCamLayerOn(false)
      jimuLayerView.layer.set({ visible: false })
      console.log('Layer visibility turned off (Default):', false)
    }
  }, [jimuMapView, props.useDataSources, layerView])

  React.useEffect(() => {
    console.log("useEffect called")
    const hls = new Hls({ debug: true })
    console.log("HLS instance created:", hls)
    if (Hls.isSupported() && currentURL) {
      hls.loadSource(currentURL)
      console.log("HLS is supported, loading source:", currentURL)
      hls.attachMedia(videoRef.current)
      hls.on(Hls.Events.ERROR, (err) => {
        console.log(err)
      })
    } else {
      console.log("load")
    }
    return () => {
      hls.destroy()
      console.log("HLS instance destroyed")
    }
  }, [currentURL])

  return (
    <>
      <div className="widget-camviewer jimu-widget" style={{ overflow: 'auto' }}>
        {useMapWidgetIds?.length > 0 && (
          <JimuMapViewComponent
            useMapWidgetId={useMapWidgetIds?.[0]}
            onActiveViewChange={activeViewChangeHandler}
          />
        )}
        <div className="view-button">
          <Button
            aria-label="Button"
            icon
            onClick={toggleLayerVisibility}
            size="default"
          >
            <Icon icon={props.config.icon.svg} size="l" />
          </Button>
        </div>
        <DataSourceComponent useDataSource={props.useDataSources[0]} query={{ where: '1=1' } as FeatureLayerQueryParams} widgetId={props.id}>
          {dataRender}
        </DataSourceComponent>
      </div>
      {videoPortal}
    </>
  )
}
