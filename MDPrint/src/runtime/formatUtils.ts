import DOMPurify from "dompurify"
import { marked } from "marked"
import printJS from "print-js"

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

/**
 * Handles the print workflow: replaces field variables in markdown, converts to HTML,
 * sanitizes, and opens a print dialog.
 *
 * @param records - The data records (selected features) to print, one page per record.
 * @param markdown - The markdown template string with ${fieldName} or ${fieldName|format} placeholders.
 * @param css - The custom CSS to apply to the print output.
 * @returns "Success" if the print dialog was opened, or an error message string.
 */
export const handlePrint = (
	records: any[],
	markdown: string,
	css: string
): string => {
	if (!records || records.length === 0) {
		return "No features selected. Please select at least one feature before printing."
	}
	if (!markdown) {
		return "No markdown content configured for this template."
	}

	try {
		const pages: string[] = []
		for (const feature of records) {
			const result = markdown.replace(/\${(.*?)}/g, (_match, contents) => {
				const [fieldName, ...formatParts] = contents.split("|")
				const field = fieldName.trim()
				const format = formatParts.length
					? formatParts.join("|").trim().replace(/['"]/g, "")
					: null
				const out = applyFormat(feature.getData()[field], format) ?? ""
				return out
			})
			const htmlOut = `<div class="markdown-content">${DOMPurify.sanitize(marked.parse(result, { async: false }))}</div>`
			const formattedHtml = htmlOut.replace(/\n/g, "<br>")
			pages.push(formattedHtml)
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
