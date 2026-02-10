import { React, type AllWidgetProps } from "jimu-core"
import {
	CalciteSlider,
	CalciteButton,
	CalciteSelect,
	CalciteOption,
	CalciteTooltip
} from "@esri/calcite-components-react"
import WMSLayer from "@arcgis/core/layers/WMSLayer.js"
import "./style.css"
import { JimuMapViewComponent, type JimuMapView } from "jimu-arcgis"
import {
	formatTimestamp,
	getExtentKey,
	fetchWmsCapabilities
} from "./wms-utils"
import {
	REFRESH_INTERVAL_MS,
	MAX_FRAMES,
	waitForViewReady,
	registerServiceWorker,
	prefetchFrames,
	refreshTimes,
	applyFrame,
	createAnimationControls,
	addFallbackLayer,
	cleanup
} from "./radar-utils"
import type { IMConfig } from "../config"

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

/**
 * Combines useState and useRef to avoid stale closure issues in intervals/callbacks
 * while still triggering React re-renders when needed
 */
function useRefState<T>(
	initialValue: T
): [T, React.RefObject<T>, (value: T) => void] {
	const [state, setState] = React.useState(initialValue)
	const ref = React.useRef(initialValue)

	const setBoth = React.useCallback((value: T) => {
		ref.current = value
		setState(value)
	}, [])

	return [state, ref, setBoth]
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function Widget(props: AllWidgetProps<IMConfig>) {
	// -------------------------------------------------------------------------
	// State and Refs
	// -------------------------------------------------------------------------
	const { config, useMapWidgetIds } = props

	const isConfigured =
		config.radarType && config.radarType !== "" && useMapWidgetIds?.length > 0

	const getDefaultsForType = React.useCallback(
		(type: string): { wmsBase: string | null; layerName: string | null } => {
			switch (type) {
				case "Precipitation":
					return {
						wmsBase:
							"https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows",
						layerName: "conus_bref_qcd"
					}
				case "Imagery":
					return {
						wmsBase: "https://fire.data.nesdis.noaa.gov/api/ogc/imagery/wms",
						layerName: "GOESEastCONUSGeoColor"
					}
				default:
					return {
						wmsBase: null,
						layerName: null
					}
			}
		},
		[]
	)
	const defaults = getDefaultsForType(config.radarType)
	const [wmsBase, setWmsBase] = React.useState(defaults.wmsBase)
	const [layerName, setLayerName] = React.useState(defaults.layerName)

	React.useEffect(() => {
		const newDefaults = getDefaultsForType(config.radarType)
		setWmsBase(newDefaults.wmsBase)
		setLayerName(newDefaults.layerName)
	}, [config.radarType, getDefaultsForType])

	const mapElementId = "radar-map"
	const wmsRef = React.useRef(null)
	const viewWatchHandleRef = React.useRef(null)
	const refreshTimerIdRef = React.useRef(null)
	const panZoomTimerRef = React.useRef(null)
	const prefetchInProgressRef = React.useRef(false)
	const prevExtentKeyRef = React.useRef(null)

	const [frames, framesRef, setFrames] = useRefState<string[]>([])
	const [idx, idxRef, setIdx] = useRefState(0)
	const [playSpeed, playSpeedRef, setPlaySpeed] = useRefState(3)

	const [playing, setPlaying] = React.useState(false)
	const intervalRef = React.useRef(null)
	const sliderRef = React.useRef(null)
	const [statusText, setStatusText] = React.useState("Status: loading...")
	const [tsText, setTsText] = React.useState("—")
	const [timeType, setTimeType] = React.useState(false)

	const applyFrameRef = React.useRef<(i: number) => void>(null)
	const startAnimationRef = React.useRef<() => void>(null)
	const stopAnimationRef = React.useRef<() => void>(null)
	const restartAnimationRef = React.useRef<() => void>(null)

	//const mvManager = MapViewManager.getInstance()
	const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
	//const jimuMapView = mvManager.getJimuMapViewById(
	//	mvManager.getAllJimuMapViewIds()[0]
	//)

	const toggleTimeType = React.useCallback(() => {
		setTimeType((prev) => !prev)
	}, [])

	// -------------------------------------------------------------------------
	// Initialization Effect
	// -------------------------------------------------------------------------
	React.useEffect(() => {
		if (!wmsBase || !layerName || !jimuMapView) return

		let view: __esri.MapView
		;(async function init() {
			view = (await jimuMapView.whenJimuMapViewLoaded()).view as __esri.MapView
			setStatusText("Status: loading...")
			try {
				// --- Fetch WMS capabilities and create layer ---
				const { times } = await fetchWmsCapabilities(wmsBase, layerName)

				wmsRef.current = new WMSLayer({
					url: wmsBase,
					title: `${config.radarType} (WMS)`,
					sublayers: [{ name: layerName }],
					opacity: 0.75,
					visible: true
				})

				// --- Add WMS layer to map, trying to respect placementLayer if specified ---
				// --- This tries to insert the WMS layer just below the specified layer ID, or on top of all layers if not found ---
				const allLayers = jimuMapView.view.map.layers.toArray()
				console.log(
					"All map layers:",
					allLayers.map((l) => l.id)
				)
				const posIndex = allLayers.findIndex(
					(l) => l.id === config.placementLayer
				)
				if (posIndex >= 0) {
					jimuMapView.view.map.add(wmsRef.current, posIndex)
				} else {
					jimuMapView.view.map.add(wmsRef.current)
				}
				setStatusText("Status: WMS layer added")

				// --- Early return if no time dimension ---
				if (!times || times.length === 0) {
					console.debug(
						"WMS capabilities did not include explicit times; rendering latest image."
					)
					setStatusText("Status: WMS layer (latest) added")
					return
				}

				// --- Initialize frames ---
				setFrames(times.slice(-MAX_FRAMES))
				setStatusText(
					`Status: ${framesRef.current.length} time frames available`
				)

				// --- Set up applyFrame function ---
				const applyFrameFn = (i: number) => {
					applyFrame(i, framesRef, wmsRef, sliderRef, setIdx, setTsText)
				}
				applyFrameRef.current = applyFrameFn

				// --- Set up animation controls ---
				const controls = createAnimationControls(
					intervalRef,
					idxRef,
					framesRef,
					playSpeedRef,
					applyFrameFn,
					setPlaying
				)
				startAnimationRef.current = controls.start
				stopAnimationRef.current = controls.stop
				restartAnimationRef.current = controls.restart

				// --- Initialize slider position ---
				if (framesRef.current.length > 0) {
					const lastIdx = framesRef.current.length - 1
					if (sliderRef.current) {
						sliderRef.current.max = String(lastIdx)
						sliderRef.current.value = String(lastIdx)
					}
					setIdx(lastIdx)
				}

				// --- Set up extent-based prefetching ---
				const schedulePrefetch = (delay = 500) => {
					if (panZoomTimerRef.current) clearTimeout(panZoomTimerRef.current)
					panZoomTimerRef.current = setTimeout(async () => {
						if (prefetchInProgressRef.current) return
						const key = getExtentKey(view)
						if (!key || key === prevExtentKeyRef.current) return

						prevExtentKeyRef.current = key
						prefetchInProgressRef.current = true
						try {
							await prefetchFrames(
								framesRef.current,
								view,
								wmsBase,
								layerName,
								setStatusText
							)
						} finally {
							prefetchInProgressRef.current = false
						}
					}, delay)
				}

				viewWatchHandleRef.current =
					view.watch?.("stationary", (isStationary) => {
						if (isStationary) schedulePrefetch(600)
					}) ??
					view.on?.("stationary", () => {
						schedulePrefetch(600)
					})

				// --- Initial prefetch after view is ready ---
				await waitForViewReady(view)
				await registerServiceWorker()
				await prefetchFrames(
					framesRef.current,
					view,
					wmsBase,
					layerName,
					setStatusText
				)

				// --- Set up periodic refresh ---
				refreshTimerIdRef.current = setInterval(
					() =>
						refreshTimes({
							framesRef,
							idxRef,
							sliderRef,
							view,
							wmsBase,
							layerName,
							setFrames,
							setIdx,
							setStatusText,
							applyFrameRef
						}),
					REFRESH_INTERVAL_MS
				)
			} catch (err) {
				console.error(`Error creating WMS layer from ${config.radarType}:`, err)
				setStatusText("Status: WMS layer error or not accessible")
				addFallbackLayer(view, setStatusText)
			}
		})()

		// --- Cleanup on unmount ---
		return () => {
			cleanup(
				intervalRef,
				refreshTimerIdRef,
				panZoomTimerRef,
				viewWatchHandleRef
			)
		}
	}, [
		jimuMapView,
		mapElementId,
		setFrames,
		setIdx,
		framesRef,
		idxRef,
		playSpeedRef,
		config.placementLayer,
		config.radarType,
		wmsBase,
		layerName
	])

	// -------------------------------------------------------------------------
	// Early return if not configured
	// -------------------------------------------------------------------------

	if (!isConfigured) {
		return (
			<div className="radar-panel radar-placeholder">
				Please configure the widget by selecting a radar type and map in the
				settings.
			</div>
		)
	}

	// -------------------------------------------------------------------------
	// JSX
	// -------------------------------------------------------------------------
	return (
		<div className="radar-panel">
			{useMapWidgetIds?.length > 0 && (
				<JimuMapViewComponent
					useMapWidgetId={useMapWidgetIds?.[0]}
					onActiveViewChange={(jmv) => {
						setJimuMapView(jmv)
					}}
				/>
			)}
			<div className="timeline-container">
				<CalciteButton
					id="timestamp"
					className="timestamp"
					kind="neutral"
					appearance="transparent"
					round
					onClick={toggleTimeType}
				>
					{formatTimestamp(tsText, timeType)}
				</CalciteButton>
				<CalciteTooltip referenceElement="timestamp" placement="top">
					<span>Toggle Time Format</span>
				</CalciteTooltip>
				<CalciteSlider
					className="timeline-slider"
					ref={sliderRef}
					min={0}
					max={Math.max(0, frames.length - 1)}
					value={idx}
					onCalciteSliderInput={(e) => {
						const val = Number(e.target.value)
						setIdx(val)
						applyFrameRef.current?.(val)
						stopAnimationRef.current?.()
					}}
				/>
			</div>
			<div className="control-row">
				<div className="radar-play-pause">
					<CalciteButton
						width="full"
						appearance={playing ? "outline" : "solid"}
						round
						onClick={() => {
							playing
								? stopAnimationRef.current?.()
								: startAnimationRef.current?.()
						}}
					>
						{playing ? "Pause" : "Play"}
					</CalciteButton>
				</div>
				<div className="speed-container">
					<div
						className="speed-label"
						style={{ fontSize: "small", paddingTop: "4px" }}
					>
						Play Speed
					</div>
					<CalciteSlider
						className="speed-slider"
						value={playSpeed}
						mirrored
						fill-placement="end"
						max={5}
						max-label="Play Speed: Upper Bound"
						min={1}
						min-label="Play Speed: Lower Bound"
						step={1}
						ticks={1}
						snap
						onCalciteSliderInput={(e) => {
							setPlaySpeed(e.target.value as number)
							restartAnimationRef.current?.()
						}}
					/>
				</div>
			</div>
			<div className="radar-status">
				{config.radarType === "Imagery" && (
					<CalciteSelect
						label="Radar Type"
						value={layerName}
						onCalciteSelectChange={(e) => {
							jimuMapView.view.map.remove(wmsRef.current)
							setPlaying(false)
							setLayerName(e.target.value)
						}}
					>
						<CalciteOption value="GOESEastCONUSGeoColor">
							GOES-East GeoColor
						</CalciteOption>
						<CalciteOption value="GOESEastCONUSFireTemp">
							GOES-East Fire Temperature
						</CalciteOption>
						<CalciteOption value="GOESEastCONUSMicrophysics">
							GOES-East Microphysics
						</CalciteOption>
						<CalciteOption value="GOESEastCONUSDayFire">
							GOES-East Day Fire
						</CalciteOption>
					</CalciteSelect>
				)}
				{statusText}
			</div>
		</div>
	)
}
