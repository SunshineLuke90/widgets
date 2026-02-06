/**
 * WMS Utility Functions
 *
 * Pure utility functions for working with WMS (Web Map Service) capabilities,
 * time dimensions, and URL building. These have no React dependencies and can
 * be unit tested in isolation.
 */

import esriRequest from "@arcgis/core/request"

// WMS XML namespace
export const WMS_NS = "http://www.opengis.net/wms"

/**
 * Find a layer element in WMS capabilities XML by name
 */
export function findLayerByName(xml: Document, layerName: string): Element | null {
	const layers = xml.getElementsByTagNameNS(WMS_NS, "Layer")
	for (let i = 0; i < layers.length; i++) {
		const nameNode = layers[i].getElementsByTagNameNS(WMS_NS, "Name")[0]
		if (nameNode?.textContent === layerName) {
			return layers[i]
		}
	}
	return null
}

/**
 * Parse comma-separated times from a text string
 */
export function parseTimesFromText(text: string): string[] {
	const trimmed = text.trim()
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
	const dims = layer.getElementsByTagNameNS(WMS_NS, "Dimension")
	for (let i = 0; i < dims.length; i++) {
		const name = dims[i].getAttribute("name")
		if (name?.toLowerCase() === "time") {
			return parseTimesFromText(dims[i].textContent || "")
		}
	}

	// Fallback: Try <Extent name="time">
	const exts = layer.getElementsByTagNameNS(WMS_NS, "Extent")
	for (let i = 0; i < exts.length; i++) {
		const name = exts[i].getAttribute("name")
		if (name?.toLowerCase() === "time") {
			return parseTimesFromText(exts[i].textContent || "")
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
