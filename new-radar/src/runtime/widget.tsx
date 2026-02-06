import { React, type AllWidgetProps } from "jimu-core"
import "@esri/calcite-components/dist/components/calcite-button"
import "@esri/calcite-components/dist/components/calcite-action-bar"
import "@esri/calcite-components/dist/components/calcite-slider"
import "@esri/calcite-components/dist/components/calcite-tooltip"
import { CalciteSlider, CalciteButton } from "@esri/calcite-components-react"
import "@arcgis/map-components/components/arcgis-map"
import "@arcgis/map-components/components/arcgis-legend"
import MapImageLayer from "@arcgis/core/layers/MapImageLayer.js"
import WMSLayer from "@arcgis/core/layers/WMSLayer.js"
import "./style.css"
import { MapViewManager } from "jimu-arcgis"
import {
	fetchWmsCapabilities,
	formatTimestamp,
	buildGetMapUrl,
	getExtentKey
} from "./wms-utils"
import type { IMConfig } from "../config"

// =============================================================================
// CONSTANTS
// =============================================================================

const WMS_BASE =
	"https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows"
const LAYER_NAME = "base_reflectivity_mosaic"
const FALLBACK_URL =
	"https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer"
const REFRESH_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes
const MAX_FRAMES = 30

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
// HELPER FUNCTIONS (stateless, receive all dependencies as parameters)
// =============================================================================

/**
 * Wait until the MapView is ready with valid extent and dimensions
 */
async function waitForViewReady(
	view: __esri.MapView,
	timeout = 15000
): Promise<void> {
	const start = Date.now()
	await view?.when?.()

	while (
		(!view.extent || (view.width === 0 && view.height === 0)) &&
		Date.now() - start < timeout
	) {
		await new Promise((resolve) => setTimeout(resolve, 200))
	}
}

/**
 * Register service worker for caching
 */
async function registerServiceWorker(): Promise<void> {
	if (!("serviceWorker" in navigator) || !("caches" in window)) {
		console.debug("ServiceWorker or Cache API not available")
		return
	}
	try {
		await navigator.serviceWorker.register(
			window.jimuConfig.mountPath + "sw-radar.js"
		)
		console.log("Service worker registered")
	} catch (e) {
		console.debug("Service worker registration failed:", e)
	}
}

/**
 * Prefetch frames for the current extent
 */
async function prefetchFrames(
	frameList: string[],
	view: __esri.MapView,
	setStatusText: (text: string) => void
): Promise<void> {
	if (!frameList || frameList.length === 0) return
	try {
		setStatusText(`Status: caching ${frameList.length} frames...`)
		const fetchPromises = frameList
			.map((time) =>
				buildGetMapUrl(
					WMS_BASE,
					LAYER_NAME,
					view.extent,
					view.width,
					view.height,
					time
				)
			)
			.filter((url): url is string => url !== null)
			.map((url) =>
				fetch(url, { mode: "cors", credentials: "omit" }).catch((err) => {
					console.debug("Prefetch failed for", url, err)
				})
			)
		await Promise.all(fetchPromises)
		setStatusText("Status: ready")
	} catch (cacheErr) {
		console.debug("Caching frames failed:", cacheErr)
	}
}

/**
 * Refresh times from WMS capabilities
 */
async function refreshTimes(params: {
	framesRef: React.RefObject<string[]>
	idxRef: React.RefObject<number>
	sliderRef: React.RefObject<any>
	view: __esri.MapView
	setFrames: (frames: string[]) => void
	setIdx: (idx: number) => void
	setStatusText: (text: string) => void
	applyFrameRef: React.RefObject<(i: number) => void>
}): Promise<void> {
	const {
		framesRef,
		idxRef,
		sliderRef,
		view,
		setFrames,
		setIdx,
		setStatusText,
		applyFrameRef
	} = params

	try {
		const { times } = await fetchWmsCapabilities(WMS_BASE, LAYER_NAME)

		if (!times || times.length === 0) {
			console.debug("refreshTimes: no times found")
			return
		}

		const newFrames = times.slice(-MAX_FRAMES)
		const newlyAdded = newFrames.filter((t) => !framesRef.current.includes(t))

		if (newlyAdded.length > 0) {
			setFrames(newFrames)
			if (sliderRef.current) {
				sliderRef.current.max = String(
					Math.max(0, framesRef.current.length - 1)
				)
			}
			if (
				idxRef.current >= framesRef.current.length ||
				idxRef.current === Number(sliderRef.current?.max)
			) {
				const newIdx = framesRef.current.length - 1
				setIdx(newIdx)
				applyFrameRef.current?.(newIdx)
			}
			setStatusText(
				`Status: ${framesRef.current.length} time frames available (updated)`
			)
			await prefetchFrames(newlyAdded, view, setStatusText)
		} else {
			console.debug("refreshTimes: no new frames")
		}
	} catch (err) {
		console.debug("refreshTimes failed:", err)
	}
}

/**
 * Apply a specific frame to the WMS layer
 */
function applyFrame(
	frameIndex: number,
	framesRef: React.RefObject<string[]>,
	wmsRef: React.RefObject<any>,
	sliderRef: React.RefObject<any>,
	setIdx: (idx: number) => void,
	setTsText: (text: string) => void
): void {
	if (!framesRef.current || framesRef.current.length === 0) return
	const timestamp = framesRef.current[frameIndex]

	// Update WMS layer time parameter
	if (wmsRef.current) {
		wmsRef.current.setCustomParameters?.({ TIME: timestamp }) ??
			(wmsRef.current.customParameters = { TIME: timestamp })
		wmsRef.current.refresh?.()
	}

	setIdx(frameIndex)
	setTsText(timestamp)
	if (sliderRef.current) {
		sliderRef.current.value = String(frameIndex)
	}
}

/**
 * Create animation control functions
 */
function createAnimationControls(
	intervalRef: React.RefObject<any>,
	idxRef: React.RefObject<number>,
	framesRef: React.RefObject<string[]>,
	playSpeedRef: React.RefObject<number>,
	applyFrameFn: (i: number) => void,
	setPlaying: (playing: boolean) => void
) {
	const start = () => {
		if (intervalRef.current) return
		setPlaying(true)
		intervalRef.current = setInterval(() => {
			idxRef.current = (idxRef.current + 1) % framesRef.current.length
			applyFrameFn(idxRef.current)
		}, playSpeedRef.current * 100)
	}

	const stop = () => {
		if (!intervalRef.current) return
		clearInterval(intervalRef.current)
		intervalRef.current = null
		setPlaying(false)
	}

	const restart = () => {
		if (!intervalRef.current) return // Only restart if already playing
		clearInterval(intervalRef.current)
		intervalRef.current = setInterval(() => {
			idxRef.current = (idxRef.current + 1) % framesRef.current.length
			applyFrameFn(idxRef.current)
		}, playSpeedRef.current * 100)
	}

	return { start, stop, restart }
}

/**
 * Add fallback MapImageLayer when WMS fails
 */
function addFallbackLayer(
	view: __esri.MapView,
	setStatusText: (text: string) => void
): void {
	try {
		const nowLayer = new MapImageLayer({
			url: FALLBACK_URL,
			id: "nowcoast-radar",
			opacity: 0.75,
			visible: true
		})
		view?.map?.add(nowLayer)
		setStatusText("Status: nowCOAST MapImageLayer added as fallback")
	} catch (e) {
		console.error("Fallback MapImageLayer failed:", e)
	}
}

/**
 * Cleanup all timers and handles
 */
function cleanup(
	intervalRef: React.RefObject<any>,
	refreshTimerIdRef: React.RefObject<any>,
	panZoomTimerRef: React.RefObject<any>,
	viewWatchHandleRef: React.RefObject<any>
): void {
	if (intervalRef.current) {
		clearInterval(intervalRef.current)
		intervalRef.current = null
	}
	if (refreshTimerIdRef.current) {
		clearInterval(refreshTimerIdRef.current)
		refreshTimerIdRef.current = null
	}
	if (panZoomTimerRef.current) {
		clearTimeout(panZoomTimerRef.current)
		panZoomTimerRef.current = null
	}
	viewWatchHandleRef.current?.remove?.()
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function Radar(
	{ mapElementId = "radar-map" },
	props: AllWidgetProps<IMConfig>
) {
	// -------------------------------------------------------------------------
	// State and Refs
	// -------------------------------------------------------------------------
	//const { config } = props
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

	const mvManager = MapViewManager.getInstance()
	const jimuMapView = mvManager.getJimuMapViewById(
		mvManager.getAllJimuMapViewIds()[0]
	)

	const toggleTimeType = React.useCallback(() => {
		setTimeType((prev) => !prev)
	}, [])

	// -------------------------------------------------------------------------
	// Initialization Effect
	// -------------------------------------------------------------------------
	React.useEffect(() => {
		let view: __esri.MapView
		;(async function init() {
			view = (await jimuMapView.whenJimuMapViewLoaded()).view as __esri.MapView
			setStatusText("Status: loading...")

			try {
				// --- Fetch WMS capabilities and create layer ---
				const { times } = await fetchWmsCapabilities(WMS_BASE, LAYER_NAME)

				wmsRef.current = new WMSLayer({
					url: WMS_BASE,
					title: "nowCOAST Radar (WMS)",
					sublayers: [{ name: LAYER_NAME }],
					opacity: 0.75,
					visible: true
				})
				//jimuMapView.getJimuLayerViewByAPILayer(props.config.placementLayer)
				view.map.add(wmsRef.current)
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
							await prefetchFrames(framesRef.current, view, setStatusText)
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
				await prefetchFrames(framesRef.current, view, setStatusText)

				// --- Set up periodic refresh ---
				refreshTimerIdRef.current = setInterval(
					() =>
						refreshTimes({
							framesRef,
							idxRef,
							sliderRef,
							view,
							setFrames,
							setIdx,
							setStatusText,
							applyFrameRef
						}),
					REFRESH_INTERVAL_MS
				)
			} catch (err) {
				console.error("Error creating WMS layer from nowCOAST:", err)
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
		playSpeedRef
	])

	// -------------------------------------------------------------------------
	// JSX
	// -------------------------------------------------------------------------
	return (
		<div className="radar-panel">
			<div className="timeline-container">
				<calcite-button
					id="timestamp"
					className="timestamp"
					kind="neutral"
					appearance="transparent"
					round
					onClick={toggleTimeType}
				>
					{formatTimestamp(tsText, timeType)}
				</calcite-button>
				<calcite-tooltip referenceElement="timestamp" placement="top">
					<span>Toggle Time Format</span>
				</calcite-tooltip>
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
			<div className="radar-status">{statusText}</div>
		</div>
	)
}
