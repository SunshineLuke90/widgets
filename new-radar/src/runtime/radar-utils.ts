/**
 * Radar Widget Helper Functions
 *
 * Stateless helper functions for the radar widget. These functions receive
 * all dependencies (including React refs) as parameters and can be safely
 * used outside of React components.
 */

import WMSLayer from "@arcgis/core/layers/WMSLayer.js"
import { fetchWmsCapabilities, buildGetMapUrl } from "./wms-utils"
import type React from "react"

// =============================================================================
// CONSTANTS
// =============================================================================

//export const WMS_BASE =
//	"https://fire.data.nesdis.noaa.gov/api/ogc/imagery/wms"
//export const LAYER_NAME = "GOESEastCONUSGeoColor"
export const FALLBACK_URL =
	"https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer"
export const REFRESH_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes
export const MAX_FRAMES = 30

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Wait until the MapView is ready with valid extent and dimensions
 */
export async function waitForViewReady(
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
export async function registerServiceWorker(): Promise<void> {
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
export async function prefetchFrames(
	frameList: string[],
	view: __esri.MapView,
	wmsBase: string,
	layerName: string,
	setStatusText: (text: string) => void
): Promise<void> {
	if (!frameList || frameList.length === 0) return
	try {
		setStatusText(`Status: caching ${frameList.length} frames...`)
		const fetchPromises = frameList
			.map((time) =>
				buildGetMapUrl(
					wmsBase,
					layerName,
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
export async function refreshTimes(params: {
	framesRef: React.RefObject<string[]>
	idxRef: React.RefObject<number>
	sliderRef: React.RefObject<any>
	view: __esri.MapView
	wmsBase: string
	layerName: string
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
		const { times } = await fetchWmsCapabilities(params.wmsBase, params.layerName)

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
			await prefetchFrames(newlyAdded, view, params.wmsBase, params.layerName, setStatusText)
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
export function applyFrame(
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
export function createAnimationControls(
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
 * Add fallback WMSLayer when primary WMS fails
 */
export function addFallbackLayer(
	view: __esri.MapView,
	setStatusText: (text: string) => void
): void {
	try {
		const fallbackLayer = new WMSLayer({
			url: FALLBACK_URL,
			id: "nowcoast-radar-fallback",
			title: "NowCOAST Radar (fallback)",
			sublayers: [{ name: "base_reflectivity_mosaic" }],
			opacity: 0.75,
			visible: true
		})
		view?.map?.add(fallbackLayer)
		setStatusText("Status: WMS fallback layer added")
	} catch (e) {
		console.error("Fallback WMSLayer failed:", e)
	}
}

/**
 * Cleanup all timers and handles
 */
export function cleanup(
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
