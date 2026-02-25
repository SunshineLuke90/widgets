import DOMPurify from "dompurify"
import { marked } from "marked"
import printJS from "print-js"
//import FeatureLayer from "esri/layers/FeatureLayer"
//import Query from "esri/rest/support/Query"

/**
  A simple date formatting function that supports the same token formatting as ArcGIS Arcade, for example:

  formatDate($feature.dateField, 'MMMMM D, YYYY') => January 1, 2024

  formatDate($feature.dateField, 'MM/DD/YYYY') => 01/01/2024

  formatDate($feature.dateField, 'YYYY-MM-DD HH:mm:ss') => 2024-01-01 13:00:00
*/
const formatDate = (date: Date, format: string) => {
	const map = {
		MMMMM: date.toLocaleString("default", { month: "long" }),
		MMM: date.toLocaleString("default", { month: "short" }),
		MM: ("0" + (date.getMonth() + 1)).slice(-2),
		M: date.getMonth() + 1,
		DDDD: date.toLocaleString("default", { weekday: "long" }),
		DDD: date.toLocaleString("default", { weekday: "short" }),
		DD: ("0" + date.getDate()).slice(-2),
		D: date.getDate(),
		YYYY: date.getFullYear(),
		YY: date.getFullYear().toString().slice(-2),
		hh: ("0" + (date.getHours() % 12 || 12)).slice(-2),
		h: date.getHours() % 12 || 12,
		HH: ("0" + date.getHours()).slice(-2),
		H: date.getHours(),
		mm: ("0" + date.getMinutes()).slice(-2),
		ss: ("0" + date.getSeconds()).slice(-2),
		A: date.getHours() >= 12 ? "PM" : "AM"
	}

	return format.replace(
		/MMMMM|MMM|MM|M|DDDD|DDD|DD|D|YYYY|YY|hh|h|HH|H|mm|ss|A/g,
		(matched) => map[matched]
	)
}

/**
  A simple number formatting function that supports comma separators and fixed decimal places, slightly different than ArcGIS Arcade, for example:

  formatNumber(1234567.89, '#,###.00') => 1,234,567.89

  formatNumber(1234.5, '0.00') => 1234.50

  formatNumber(1234.5678, '0.0') => 1234.6
*/
const formatNumber = (num: number, format: string) => {
	// Example: '#,###.00'
	const hasComma = format.includes(",")
	const decimalMatches = format.match(/\.(\d+)/)
	const decimalPlaces = decimalMatches ? decimalMatches[1].length : 0

	let result = num.toFixed(decimalPlaces)

	if (hasComma) {
		const parts = result.split(".")
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
		result = parts.join(".")
	}

	return result
}

export const applyFormat = (value: any, format: string) => {
	// If no format is provided, just return the raw value (or a string version)
	if (!format) return value ?? ""

	const isDateFormat = /[YMDhms]/.test(format)
	const isNumberFormat = /[#0]/.test(format)

	// 2. Route based on intent
	if (isDateFormat) {
		// Convert number/string to Date object first
		const date = new Date(Number(value) || value)
		return formatDate(date, format)
	}

	if (isNumberFormat) {
		const num = parseFloat(value)
		return formatNumber(num, format)
	}

	return value ?? "" // Fallback for strings or unknown types
}

// Helper: replace placeholders in a template string with values from a provided attributes object
const replacePlaceholders = (
	templateStr: string,
	attrsProvider: (field: string, format?: string) => any
) =>
	templateStr.replace(/\${(.*?)}/g, (_m, contents) => {
		const [fieldName, ...formatParts] = contents.split("|")
		const field = fieldName.trim()
		const format = formatParts.length
			? formatParts.join("|").trim().replace(/['"]/g, "")
			: null
		const val = attrsProvider(field, format)
		return val ?? ""
	})

// Helper: run a feature service query and render innerTemplate for each returned feature
const processQueryBlock = async (
	originalFeature: any,
	layerUrlRaw: string,
	whereRaw: string,
	innerTemplate: string
) => {
	// 1) Replace any ${...} inside where with the original feature values
	const whereClause = replacePlaceholders(whereRaw, (field, fmt) => {
		const val = originalFeature.getData()[field]
		return applyFormat(val, fmt)
	})

	// 2) Build query URL (append /query if needed)
	const layerUrl = layerUrlRaw.trim()
	const queryEndpoint =
		/lowercase/i.test("") && layerUrl.toLowerCase().includes("/query")
			? layerUrl
			: layerUrl.replace(/\/+$/, "") + "/query"

	// 3) Execute query (outFields=*). Keep simple; callers can provide precise where to limit results.
	const params = new URLSearchParams({
		where: whereClause,
		outFields: "*",
		f: "json"
	})
	const resp = await fetch(queryEndpoint + "?" + params.toString())
	if (!resp.ok) {
		throw new Error(`Query failed (${resp.status}) for ${layerUrl}`)
	}
	const json = await resp.json()
	const feats = json.features || []

	// 4) For each returned feature, render innerTemplate using its attributes
	const renderedParts = feats.map((f: any) => {
		const attrs = f.attributes || {}
		return replacePlaceholders(innerTemplate, (field, fmt) =>
			applyFormat(attrs[field], fmt)
		)
	})

	// Join rendered parts (no page-break inside the block; outer logic can control that)
	return renderedParts.join("")
}

/**
 * Handles the print workflow: replaces field variables in markdown, converts to HTML,
 * sanitizes, and opens a print dialog.
 *
 * @param records - The data records (selected features) to print, one page per record.
 * @param markdown - The markdown template string with ${fieldName} or ${fieldName|format} placeholders.
 * @param css - The custom CSS to apply to the print output.
 * @returns "Success" if the print dialog was opened, or an error message string.
 */
export const handlePrint = async (
	records: any[],
	markdown: string,
	css: string
): Promise<string> => {
	if (!records || records.length === 0) {
		return "No features selected. Please select at least one feature before printing."
	}
	if (!markdown) {
		return "No markdown content configured for this template."
	}

	try {
		const pages: string[] = []

		// For each original record (one printed page per original feature)
		for (const feature of records) {
			let template = markdown

			// Process all Query blocks iteratively (supports multiple blocks)
			// Start-tag syntax: ${Query|<layerUrl>|<whereClause>}
			// End-tag syntax: ${/Query}
			// The where clause may contain nested ${field} placeholders, so we need
			// a regex that allows } inside ${...} within the where group.
			const queryStartRegex =
				/\${\s*Query\s*\|((?:(?!\$\{).)*?)\|((?:(?:\$\{[^}]*\})|[^}])*?)\s*}/i
			let match = queryStartRegex.exec(template)
			while (match) {
				const fullStart = match[0]
				const layerUrlRaw = match[1]
				const whereRaw = match[2]

				// find corresponding end tag after the start
				const startIndex = match.index + fullStart.length
				const endTag = "${/Query}"
				const endIndex = template.indexOf(endTag, startIndex)
				if (endIndex === -1) throw new Error("Unclosed Query block in template")

				const innerTemplate = template.substring(startIndex, endIndex)

				// Execute query and render inner template for returned features
				const rendered = await processQueryBlock(
					feature,
					layerUrlRaw,
					whereRaw,
					innerTemplate
				)

				// Replace the entire block (start...inner...end) with rendered content
				const blockStartIdx = match.index
				const blockEndIdx = endIndex + endTag.length
				template =
					template.substring(0, blockStartIdx) +
					rendered +
					template.substring(blockEndIdx)

				// Look for next Query block
				match = queryStartRegex.exec(template)
			}

			// After query blocks are expanded, replace remaining placeholders from the original feature
			const result = replacePlaceholders(template, (field, fmt) => {
				const val = feature.getData()[field]
				return applyFormat(val, fmt)
			})

			const htmlOut = `<div class="markdown-content">${DOMPurify.sanitize(
				marked.parse(result, { async: false, breaks: true, gfm: true })
			)}</div>`
			pages.push(htmlOut)
		}

		const combinedHtml = pages.join(
			'<div style="page-break-after: always;"></div>'
		)
		const cleanCss = "@page { margin: 20px; } " + css.replace(/\n/g, "")
		printJS({ printable: combinedHtml, type: "raw-html", style: cleanCss })
		return "Success"
	} catch (error) {
		return `Print failed: ${error instanceof Error ? error.message : String(error)}`
	}
}
