import { React, type AllWidgetProps, type DataSource, DataSourceComponent, type FeatureLayerQueryParams } from 'jimu-core'
import type { IMConfig } from '../config'
import defaultMessages from './translations/default'
import { JimuMapViewComponent, type JimuMapView, type JimuLayerView } from 'jimu-arcgis'
import { Button, Icon } from 'jimu-ui'
// @ts-expect-error - No types available for this package
import './style.css'
import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
// You need to install hls.js into your client directory
// Run npm install hls.js in your client directory to install.
import Hls from 'hls.js'
import 'calcite-components'


interface FeedData {
  id: string
  url: string
  initialPos: { x: number, y: number }
}

interface CameraFeedProps {
  feed: FeedData
  onClose: (id: string, url: string) => void
}

function CameraFeed ({ feed, onClose }: CameraFeedProps) {
  const [pos, setPos] = useState(feed.initialPos)
  const [size, setSize] = useState({ width: 250, height: 140 })
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizing, setResizing] = useState(false)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 250, height: 140 })
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    if (!videoRef.current) return
    const video = videoRef.current
    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(feed.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => { console.warn('Autoplay prevented:', err) })
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('HLS error:', data)
      })
      return () => { hls.destroy() }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: native HLS support
      video.src = feed.url
      video.play().catch(err => { console.warn('Autoplay prevented:', err) })
    } else {
      // Fallback for direct video URLs (MP4, etc.)
      video.src = feed.url
    }
  }, [feed.url])

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (dragging) {
      setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
    } else if (resizing) {
      const dx = e.clientX - resizeStart.x
      const newWidth = Math.max(120, resizeStart.width + dx)
      const newHeight = Math.round(newWidth / aspectRatio)
      setSize({ width: newWidth, height: newHeight })
    }
  }, [dragging, dragOffset, resizing, resizeStart, aspectRatio])

  const handleMouseUp = React.useCallback(() => {
    setDragging(false)
    setResizing(false)
  }, [])

  React.useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
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
        if ((e.target as HTMLElement).classList.contains('video-close-btn') || (e.target as HTMLElement).classList.contains('video-resize-handle')) return
        setDragging(true)
        setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y })
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
        onClick={() => { onClose(feed.id, feed.url) }}
        title="Close"
      >×</div>
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay={true}
        style={{ width: size.width, height: size.height, borderRadius: 10, display: 'block' }}
        className={'cameraViewer-video'}
        onLoadedMetadata={e => {
          const video = e.currentTarget
          if (video.videoWidth && video.videoHeight) {
            const ratio = video.videoWidth / video.videoHeight
            setAspectRatio(ratio)
            setSize(prev => ({ width: prev.width, height: Math.round(prev.width / ratio) }))
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
          setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height })
        }}
        title="Resize"
      >
        <svg width="16" height="16" viewBox="0 0 16 16"><polyline points="4,16 16,4" stroke="#fff" strokeWidth="2" fill="none" /></svg>
      </div>
    </div>,
    document.body
  )
}

export default function Widget (props: AllWidgetProps<IMConfig>) {
  const { useDataSources, useMapWidgetIds } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)

  const isConfigured = useDataSources && useDataSources.length > 0 && useDataSources[0].dataSourceId && useDataSources[0].fields && useDataSources[0].fields.length > 0

  const [layerView, setLayerView] = React.useState<JimuLayerView | undefined>(undefined)
  const [camLayerOn, setCamLayerOn] = React.useState(false)
  const [feeds, setFeeds] = useState<FeedData[]>([])
  // Tracks which URLs are currently open so we don't open the same feed twice
  const openUrlsRef = React.useRef<Set<string>>(new Set())
  const dsRef = React.useRef<DataSource>(null)

  // Multiple-mode toggle
  const [multipleMode, setMultipleMode] = useState(false)
  const multipleModeRef = React.useRef(true)
  const [controlsAbove, setControlsAbove] = useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const closePopupTimerRef = React.useRef<number | undefined>(undefined)
  const [popupPos, setPopupPos] = useState({ left: 0, top: 0 })
  const [showPopup, setShowPopup] = useState(false)

  const dataRender = (ds: DataSource) => {
    dsRef.current = ds
    const selectedRecords = ds.getSelectedRecords()
    const fieldName = props.useDataSources[0].fields[0]
    if (selectedRecords.length > 0) {
      const url = selectedRecords[0].getFieldValue(fieldName) as string
      if (url && !openUrlsRef.current.has(url)) {
        if (!multipleModeRef.current) {
          // Single mode: replace all existing feeds with this one
          openUrlsRef.current = new Set([url])
          setFeeds([{ id: `feed-${Date.now()}`, url, initialPos: { x: 100, y: 100 } }])
        } else {
          // Multiple mode: add a new feed offset from existing ones
          openUrlsRef.current.add(url)
          const offset = openUrlsRef.current.size - 1
          setFeeds(prev => [...prev, {
            id: `feed-${Date.now()}`,
            url,
            initialPos: { x: 100 + offset * 30, y: 100 + offset * 30 }
          }])
        }
      }
    }
  }

  // Keep multipleModeRef in sync whenever the switch changes
  React.useEffect(() => {
    multipleModeRef.current = multipleMode
  }, [multipleMode])

  // If multiple support is disabled in widget config, force single mode and hide popup.
  React.useEffect(() => {
    if (props.config?.multiple) return
    setMultipleMode(false)
    setShowPopup(false)
  }, [props.config?.multiple])

  // If user turns multiple mode off while several feeds are open, keep only one.
  React.useEffect(() => {
    if (multipleMode || feeds.length <= 1) return
    const ds = dsRef.current
    const fieldName = props.useDataSources[0].fields[0]
    let keepUrl: string | undefined
    if (ds) {
      const selected = ds.getSelectedRecords()
      if (selected.length > 0) {
        keepUrl = selected[0].getFieldValue(fieldName) as string
      }
    }
    const fallbackUrl = keepUrl ?? feeds[feeds.length - 1]?.url
    if (!fallbackUrl) return
    openUrlsRef.current = new Set([fallbackUrl])
    setFeeds([{ id: `feed-${Date.now()}`, url: fallbackUrl, initialPos: { x: 100, y: 100 } }])
  }, [multipleMode, feeds, props.useDataSources])

  const updatePopupPosition = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const popupHeight = 38
    const gap = 6
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < popupHeight + gap && spaceAbove > popupHeight + gap
    setControlsAbove(placeAbove)
    setPopupPos({
      left: rect.left + rect.width / 2,
      top: placeAbove ? rect.top - gap : rect.bottom + gap
    })
  }, [])

  // Recalculate popup placement whenever it opens, and while viewport changes.
  React.useLayoutEffect(() => {
    if (!showPopup) return
    updatePopupPosition()
    const handleLayout = () => { updatePopupPosition() }
    window.addEventListener('resize', handleLayout)
    window.addEventListener('scroll', handleLayout, true)
    return () => {
      window.removeEventListener('resize', handleLayout)
      window.removeEventListener('scroll', handleLayout, true)
    }
  }, [showPopup, updatePopupPosition])

  const cancelClosePopupTimer = useCallback(() => {
    if (closePopupTimerRef.current !== undefined) {
      window.clearTimeout(closePopupTimerRef.current)
      closePopupTimerRef.current = undefined
    }
  }, [])

  const scheduleClosePopup = useCallback(() => {
    cancelClosePopupTimer()
    closePopupTimerRef.current = window.setTimeout(() => {
      setShowPopup(false)
    }, 150)
  }, [cancelClosePopupTimer])

  React.useEffect(() => {
    return () => {
      cancelClosePopupTimer()
    }
  }, [cancelClosePopupTimer])

  const modePopup = (props.config?.multiple && showPopup) ? createPortal(
    <div
      ref={popupRef}
      onMouseEnter={() => {
        cancelClosePopupTimer()
        setShowPopup(true)
      }}
      onMouseLeave={() => {
        scheduleClosePopup()
      }}
      style={{
        position: 'fixed',
        left: popupPos.left,
        top: popupPos.top,
        transform: controlsAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'var(--calcite-color-foreground-1, #fff)',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 20000,
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ fontSize: 12 }}>Multiple</span>
      <calcite-switch
        scale="s"
        checked={multipleMode}
        oncalciteSwitchChange={(e: any) => { setMultipleMode(Boolean(e.target?.checked)) }}
      />
    </div>,
    document.body
  ) : null

  const closeFeed = useCallback((id: string, url: string) => {
    openUrlsRef.current.delete(url)
    setFeeds(prev => prev.filter(f => f.id !== id))
    // If the closed feed's URL is the currently selected feature, deselect it
    const ds = dsRef.current
    if (ds) {
      const fieldName = props.useDataSources[0].fields[0]
      const selected = ds.getSelectedRecords()
      if (selected.length > 0 && selected[0].getFieldValue(fieldName) === url) {
        ds.clearSelection()
      }
    }
  }, [props.useDataSources])

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
    }
  }, [jimuMapView, props.useDataSources, layerView])

  if (!isConfigured) {
    return (
      <div className="widget-camviewer jimu-widget">
        <div className="widget-camviewer-not-configured">
          {defaultMessages.notConfigured}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="widget-camviewer jimu-widget" style={{ overflow: 'auto' }}>
        {useMapWidgetIds?.length > 0 && (
          <JimuMapViewComponent
            useMapWidgetId={useMapWidgetIds?.[0]}
            onActiveViewChange={activeViewChangeHandler}
          />
        )}
        <div
          ref={wrapperRef}
          onMouseEnter={() => {
            if (!props.config?.multiple) return
            cancelClosePopupTimer()
            setShowPopup(true)
          }}
          onMouseLeave={() => {
            if (!props.config?.multiple) return
            scheduleClosePopup()
          }}
          style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
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
        </div>
        <DataSourceComponent useDataSource={props.useDataSources[0]} query={{ where: '1=1' } as FeatureLayerQueryParams} widgetId={props.id}>
          {(ds: DataSource) => {
            dataRender(ds)
            return null
          }}
        </DataSourceComponent>
      </div>
      {feeds.map(feed => (
        <CameraFeed key={feed.id} feed={feed} onClose={closeFeed} />
      ))}
      {modePopup}
    </>
  )
}
