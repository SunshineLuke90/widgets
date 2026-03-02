import {
	React,
	type AllWidgetProps,
	DataSourceComponent,
	type FeatureLayerQueryParams
} from "jimu-core"
import noUiSlider, { type API as NoUiSliderAPI, PipsMode } from "nouislider"
import "nouislider/dist/nouislider.css"
import type { IMConfig } from "../config"
import "./style.css"
import { Paper } from "jimu-ui"

const { useState, useCallback, useRef, useMemo, useEffect } = React

/** Format a number with comma separators. */
function formatNumber(val: number): string {
	return val.toLocaleString()
}

/** Format a date/epoch for display. */
function formatDate(val: number | Date): string {
	const d = typeof val === "number" ? new Date(val) : val
	return d.toLocaleDateString()
}

export default function Widget(props: AllWidgetProps<IMConfig>) {
	const { config, id: widgetId, useDataSources } = props

	const minValue =
		config.rangeType === "NUMBER"
			? (config.minValue as number)
			: new Date(config.minValue as unknown as string).getTime()
	const maxValue =
		config.rangeType === "NUMBER"
			? (config.maxValue as number)
			: new Date(config.maxValue as unknown as string).getTime()

	const [whereClause, setWhereClause] = useState<string>("1=1")

	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
	const sliderContainerRef = useRef<HTMLDivElement>(null)
	const sliderApiRef = useRef<NoUiSliderAPI | null>(null)

	const fieldName = useDataSources?.[0]?.fields?.[0]

	/** Format value for display. */
	const getValueDisplay = useCallback(
		(val: number) => {
			if (config.rangeType === "NUMBER") return formatNumber(val)
			return formatDate(val)
		},
		[config.rangeType]
	)

	/** Build a WHERE clause from the current range. */
	const buildWhereClause = useCallback(
		(lo: number, hi: number): string => {
			if (!fieldName) return "1=1"
			if (config.rangeType === "NUMBER") {
				return `${fieldName} >= ${lo} AND ${fieldName} <= ${hi}`
			}
			const loDate = new Date(lo).toISOString()
			const hiDate = new Date(hi).toISOString()
			return `${fieldName} >= '${loDate}' AND ${fieldName} <= '${hiDate}'`
		},
		[fieldName, config.rangeType]
	)

	/** Debounced filter update. */
	const applyFilter = useCallback(
		(lo: number, hi: number) => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
			debounceRef.current = setTimeout(() => {
				setWhereClause(buildWhereClause(lo, hi))
			}, 200)
		},
		[buildWhereClause]
	)

	// Gradient colors
	const startColor = config.startColor || "var(--jimu-primary)"
	const endColor = config.endColor || "var(--jimu-primary)"

	const useDataSource = useDataSources?.[0]

	/** Compute pips (ticks) configuration for noUiSlider. */
	const pipsConfig = useMemo(() => {
		if (!config.showTicks || !config.tickInterval || config.tickInterval <= 0) {
			return undefined
		}

		let stepVal = config.tickInterval
		if (config.rangeType !== "NUMBER") {
			const interval = config.tickDateInterval || "MONTH"
			const msPerUnit: { [key: string]: number } = {
				MINUTE: 60_000,
				HOUR: 3_600_000,
				DAY: 86_400_000,
				MONTH: 30 * 86_400_000,
				YEAR: 365 * 86_400_000
			}
			stepVal = config.tickInterval * (msPerUnit[interval] || 86_400_000)
		}

		// Generate tick values
		const values: number[] = []
		for (let v = minValue; v <= maxValue; v += stepVal) {
			values.push(v)
		}
		// Ensure max is always included
		if (values[values.length - 1] !== maxValue) {
			values.push(maxValue)
		}

		return {
			mode: PipsMode.Values as const,
			values,
			density: 100,
			format: {
				to: (val: number) => {
					if (config.rangeType === "NUMBER") return formatNumber(val)
					return formatDate(val)
				}
			}
		}
	}, [
		config.showTicks,
		config.tickInterval,
		config.tickDateInterval,
		config.rangeType,
		minValue,
		maxValue
	])

	// ── noUiSlider lifecycle ──

	/** Stable ref for callbacks so the slider event handlers always see current values. */
	const callbacksRef = useRef({ applyFilter, buildWhereClause, setWhereClause })
	useEffect(() => {
		callbacksRef.current = { applyFilter, buildWhereClause, setWhereClause }
	}, [applyFilter, buildWhereClause, setWhereClause])

	/** Create the slider once on mount. */
	useEffect(() => {
		const el = sliderContainerRef.current
		if (!el) return

		const step = config.rangeType === "NUMBER" ? 1 : 86_400_000

		const api = noUiSlider.create(el, {
			start: [minValue, maxValue],
			connect: [true, true, true],
			range: { min: minValue, max: maxValue },
			step,
			tooltips: config.showCurrentValue
				? [
						{
							to: (v: number) =>
								config.rangeType === "NUMBER" ? formatNumber(v) : formatDate(v)
						},
						{
							to: (v: number) =>
								config.rangeType === "NUMBER" ? formatNumber(v) : formatDate(v)
						}
					]
				: false,
			pips: pipsConfig
		})

		sliderApiRef.current = api

		// Move pips inside .noUi-base so ticks, connects, and handles share
		// the same stacking context for correct z-index layering.
		const pipsEl = el.querySelector(".noUi-pips")
		const baseEl = el.querySelector(".noUi-base")
		if (pipsEl && baseEl) {
			baseEl.appendChild(pipsEl)
		}

		// Slide event — fires during drag
		api.on("slide", (values: Array<string | number>) => {
			const lo = Number(values[0])
			const hi = Number(values[1])
			callbacksRef.current.applyFilter(lo, hi)
		})

		// Change event — fires on release
		api.on("change", (values: Array<string | number>) => {
			const lo = Number(values[0])
			const hi = Number(values[1])
			if (debounceRef.current) clearTimeout(debounceRef.current)
			callbacksRef.current.setWhereClause(
				callbacksRef.current.buildWhereClause(lo, hi)
			)
		})

		return () => {
			api.destroy()
			sliderApiRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Create once on mount

	/** Update slider when config changes (range, ticks, tooltips). */
	useEffect(() => {
		const api = sliderApiRef.current
		if (!api) return

		const step = config.rangeType === "NUMBER" ? 1 : 86_400_000

		api.updateOptions(
			{
				range: { min: minValue, max: maxValue },
				start: [minValue, maxValue],
				step,
				tooltips: config.showCurrentValue
					? [
							{
								to: (v: number) =>
									config.rangeType === "NUMBER"
										? formatNumber(v)
										: formatDate(v)
							},
							{
								to: (v: number) =>
									config.rangeType === "NUMBER"
										? formatNumber(v)
										: formatDate(v)
							}
						]
					: false,
				pips: pipsConfig
			},
			true
		)

		// After updateOptions, pips are recreated — move them back inside .noUi-base
		const el = sliderContainerRef.current
		if (el) {
			const pipsEl = el.querySelector(".noUi-pips")
			const baseEl = el.querySelector(".noUi-base")
			if (pipsEl && baseEl) {
				baseEl.appendChild(pipsEl)
			}
		}
	}, [
		minValue,
		maxValue,
		config.rangeType,
		config.showCurrentValue,
		pipsConfig
	])

	/** Apply static gradient to the full track and gray out-of-range segments. */
	useEffect(() => {
		const el = sliderContainerRef.current
		if (!el) return

		// Gradient on the base track (spans entire width)
		const base = el.querySelector<HTMLElement>(".noUi-base")
		if (base) {
			base.style.background = `linear-gradient(to right, ${startColor}, ${endColor})`
		}

		// Mark 1st and 3rd connect segments as gray (out-of-range)
		const connects = el.querySelectorAll<HTMLElement>(".noUi-connect")
		connects.forEach((c, i) => {
			if (i === 0 || i === 2) {
				c.classList.add("noUi-connect-gray")
			} else {
				c.classList.remove("noUi-connect-gray")
			}
		})
	}, [startColor, endColor])

	// ── Tooltip positioning — opposite side of each label ──
	const minLabelPos = config.minLabelPosition || "TOP"
	const maxLabelPos = config.maxLabelPosition || "TOP"
	const minTooltipBelow = minLabelPos === "TOP" // label top → tooltip bottom
	const maxTooltipBelow = maxLabelPos === "TOP" // label top → tooltip bottom

	let tooltipClass = ""
	if (config.showCurrentValue) {
		if (minTooltipBelow && maxTooltipBelow) {
			tooltipClass = "tooltips-below"
		} else if (!minTooltipBelow && !maxTooltipBelow) {
			tooltipClass = "tooltips-above"
		} else if (minTooltipBelow) {
			tooltipClass = "tooltips-mixed-min-below"
		} else {
			tooltipClass = "tooltips-mixed-min-above"
		}
	}

	// When both tooltips are on the same side, add 25px buffer so they don't clip
	const bothSameSide = minTooltipBelow === maxTooltipBelow
	const tooltipBuffer = config.showCurrentValue && bothSameSide ? 25 : 0
	const wrapperPaddingTop =
		config.showCurrentValue && bothSameSide && !minTooltipBelow
			? tooltipBuffer
			: 0
	const wrapperPaddingBottom =
		config.showCurrentValue && bothSameSide && minTooltipBelow
			? tooltipBuffer
			: 0

	return (
		<Paper>
			<div
				className={[
					"slider-filter-widget",
					`slider-filter-${widgetId}`,
					"jimu-widget",
					tooltipClass
				]
					.filter(Boolean)
					.join(" ")}
				style={{
					padding: "12px 16px",
					flexDirection: "column"
				}}
			>
				{/* Top labels */}
				{(config.minLabelPosition === "TOP" ||
					config.maxLabelPosition === "TOP") && (
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 13,
							color: "var(--jimu-text-secondary)",
							marginBottom: 8
						}}
					>
						<span>
							{config.minLabelPosition === "TOP"
								? config.minLabel || getValueDisplay(minValue)
								: ""}
						</span>
						<span>
							{config.maxLabelPosition === "TOP"
								? config.maxLabel || getValueDisplay(maxValue)
								: ""}
						</span>
					</div>
				)}

				{/* noUiSlider container */}
				<div
					className="slider-track-wrapper"
					style={{
						paddingTop: wrapperPaddingTop > 0 ? wrapperPaddingTop : undefined,
						paddingBottom:
							wrapperPaddingBottom > 0 ? wrapperPaddingBottom : undefined
					}}
				>
					<div ref={sliderContainerRef} />
				</div>

				{/* Bottom labels */}
				{(config.minLabelPosition === "BOTTOM" ||
					config.maxLabelPosition === "BOTTOM") && (
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 13,
							color: "var(--jimu-text-secondary)",
							marginTop: 8
						}}
					>
						<span>
							{config.minLabelPosition === "BOTTOM"
								? config.minLabel || getValueDisplay(minValue)
								: ""}
						</span>
						<span>
							{config.maxLabelPosition === "BOTTOM"
								? config.maxLabel || getValueDisplay(maxValue)
								: ""}
						</span>
					</div>
				)}

				{/* DataSourceComponent for filtering */}
				{useDataSource && (
					<DataSourceComponent
						useDataSource={useDataSource}
						query={
							{
								where: whereClause,
								outFields: ["*"],
								returnGeometry: true
							} as FeatureLayerQueryParams
						}
						widgetId={widgetId}
					></DataSourceComponent>
				)}
			</div>
		</Paper>
	)
}
