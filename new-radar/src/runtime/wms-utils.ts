/**
 * WMS Utility Functions
 *
 * Pure utility functions for working with WMS (Web Map Service) capabilities,
 * time dimensions, and URL building. These have no React dependencies and can
 * be unit tested in isolation.
 */

import esriRequest from "@arcgis/core/request"

// WMS XML namespace (used by some servers; others omit the namespace)
export const WMS_NS = "http://www.opengis.net/wms"

/**
 * Helper: get elements by tag name, trying namespaced first, then non-namespaced.
 * Many WMS servers (e.g. GeoServer) include the OGC namespace, while others
 * (e.g. the NESDIS fire portal) emit plain XML without a namespace.
 */
function getElementsByTag(parent: Element | Document, tag: string): Element[] {
	// Try namespaced first
	let els = parent.getElementsByTagNameNS(WMS_NS, tag)
	if (els.length > 0) return Array.from(els)
	// Fall back to non-namespaced
	els = parent.getElementsByTagName(tag)
	return Array.from(els)
}

/**
 * Find a layer element in WMS capabilities XML by name
 */
export function findLayerByName(xml: Document, layerName: string): Element | null {
	const layers = getElementsByTag(xml, "Layer")
	for (const layer of layers) {
		// Look for a direct child <Name> element
		const nameNodes = getElementsByTag(layer, "Name")
		for (const nameNode of nameNodes) {
			if (nameNode.textContent === layerName && nameNode.parentElement === layer) {
				return layer
			}
		}
	}
	return null
}

/**
 * Parse an ISO 8601 duration string (e.g. "PT5M", "PT1H", "PT30S") to milliseconds.
 */
export function parseIsoDuration(iso: string): number {
	const match = iso.match(
		/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/
	)
	if (!match) return 0
	const days = parseInt(match[1] || "0", 10)
	const hours = parseInt(match[2] || "0", 10)
	const minutes = parseInt(match[3] || "0", 10)
	const seconds = parseFloat(match[4] || "0")
	return ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000
}

/**
 * Format a Date as YYYY-MM-DDTHH:MM:SSZ (no fractional seconds).
 * Many WMS servers (including the NESDIS fire portal) reject millisecond
 * precision that JavaScript's Date.toISOString() produces (.000Z).
 */
function formatWmsTime(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0")
	return (
		date.getUTCFullYear() +
		"-" +
		pad(date.getUTCMonth() + 1) +
		"-" +
		pad(date.getUTCDate()) +
		"T" +
		pad(date.getUTCHours()) +
		":" +
		pad(date.getUTCMinutes()) +
		":" +
		pad(date.getUTCSeconds()) +
		"Z"
	)
}

/**
 * Expand an ISO 8601 time interval (start/end/period) into discrete timestamps.
 * Only generates the last `maxFrames` timestamps to avoid creating huge arrays.
 */
export function expandTimeInterval(
	intervalStr: string,
	maxFrames: number
): string[] {
	const parts = intervalStr.trim().split("/")
	if (parts.length !== 3) return []

	const start = new Date(parts[0]).getTime()
	const end = new Date(parts[1]).getTime()
	const stepMs = parseIsoDuration(parts[2])

	if (isNaN(start) || isNaN(end) || stepMs <= 0) return []

	// Calculate total number of steps
	const totalSteps = Math.floor((end - start) / stepMs)

	// Only generate the last `maxFrames` timestamps
	const firstStep = Math.max(0, totalSteps - maxFrames + 1)
	const times: string[] = []
	for (let i = firstStep; i <= totalSteps; i++) {
		times.push(formatWmsTime(new Date(start + i * stepMs)))
	}
	return times
}

/**
 * Parse comma-separated times from a text string
 */
export function parseTimesFromText(text: string): string[] {
	const trimmed = text.trim()

	// Check if it's an ISO 8601 time interval (start/end/period)
	if (trimmed.includes("/") && !trimmed.includes(",")) {
		return expandTimeInterval(trimmed, 30)
	}

	// Otherwise treat as comma-separated list
	if (trimmed.includes(",")) {
		return trimmed.split(",").map((s) => s.trim())
	}
	return trimmed ? [trimmed] : []
}

/**
 * Extract time dimension values from a WMS layer element.
 * Checks both <Dimension> and <Extent> elements for time data.
 */
export function extractTimesFromLayer(layer: Element | null): string[] {
	if (!layer) return []

	// Try <Dimension name="time">
	const dims = getElementsByTag(layer, "Dimension")
	for (const dim of dims) {
		const name = dim.getAttribute("name")
		if (name?.toLowerCase() === "time") {
			return parseTimesFromText(dim.textContent || "")
		}
	}

	// Fallback: Try <Extent name="time">
	const exts = getElementsByTag(layer, "Extent")
	for (const ext of exts) {
		const name = ext.getAttribute("name")
		if (name?.toLowerCase() === "time") {
			return parseTimesFromText(ext.textContent || "")
		}
	}

	return []
}

/**
 * Fetch and parse WMS capabilities, returning times for a specific layer
 */
export async function fetchWmsCapabilities(
	wmsBase: string,
	layerName: string
): Promise<{ layer: Element | null; times: string[] }> {
	const capsResp = await esriRequest(
		`${wmsBase}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,
		{ responseType: "text" }
	)
	const parser = new DOMParser()
	const xml = parser.parseFromString(capsResp.data, "application/xml")
	const layer = findLayerByName(xml, layerName)
	const times = extractTimesFromLayer(layer)
	return { layer, times }
}

/**
 * Format a timestamp for display - either as relative time or localized string
 */
export function formatTimestamp(tsText: string, useRelative: boolean): string {
	if (tsText === "—") return tsText
	const dt = new Date(tsText)
	if (useRelative) {
		const minutesAgo = Math.round((Date.now() - dt.getTime()) / (1000 * 60))
		return `${minutesAgo} minutes ago`
	}
	return dt.toLocaleString()
}

/**
 * Build a WMS GetMap URL for a specific time frame
 */
export function buildGetMapUrl(
	wmsBase: string,
	layerName: string,
	extent: __esri.Extent,
	width: number,
	height: number,
	time: string
): string | null {
	try {
		const bbox = [extent.xmin, extent.ymin, extent.xmax, extent.ymax].join(",")
		const params = new URLSearchParams({
			service: "WMS",
			version: "1.3.0",
			request: "GetMap",
			layers: layerName,
			styles: "",
			crs: "EPSG:3857",
			bbox: bbox,
			width: String(Math.max(256, width || 1024)),
			height: String(Math.max(256, height || 1024)),
			format: "image/png",
			transparent: "TRUE",
			time: time
		})
		return `${wmsBase}?${params.toString()}`
	} catch (err) {
		console.debug("Failed to build GetMap URL for prefetch:", err)
		return null
	}
}

/**
 * Get a unique key representing the current map extent and size.
 * Useful for detecting when the view has changed and prefetch is needed.
 */
export function getExtentKey(view: __esri.MapView): string {
	try {
		const e = view.extent
		if (!e) return ""
		return [
			e.xmin,
			e.ymin,
			e.xmax,
			e.ymax,
			view.width || 0,
			view.height || 0
		].join(",")
	} catch {
		return ""
	}
}
