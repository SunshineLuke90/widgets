import {
	React,
	type AllWidgetProps,
	DataSourceComponent,
	type DataSource,
	dataSourceUtils,
	type StatisticDefinition,
	type QueryScope,
	type ArcGISQueriableDataSource,
	type ArcGISQueryParams
} from "jimu-core"
import { Icon } from "jimu-ui"
import type { IMConfig } from "../config"
import {
	computeAllValues,
	buildExpressionValues,
	resolveExpressions,
	fontSizeToFlexGrow
} from "./utils"

// Load QueryScope at runtime — it's a const enum that needs a real value

const { QueryScope: QScope } = require("jimu-core") as {
	QueryScope: { [key: string]: string }
}

// ── Loading spinner ───────────────────────────────────────────────────────────

const spinnerKeyframes = `
@keyframes ind-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`

const Spinner = () => (
	<>
		<style>{spinnerKeyframes}</style>
		<div
			style={{
				width: 36,
				height: 36,
				border: "3px solid rgba(128,128,128,0.25)",
				borderTopColor: "currentColor",
				borderRadius: "50%",
				animation: "ind-spin 0.8s linear infinite"
			}}
		/>
	</>
)

// ── AutoFitText ───────────────────────────────────────────────────────────────
// Fills its parent div with the largest possible font that still fits.

interface AutoFitTextProps {
	text: string
	color: string
	fontWeight?: string | number
}

const AutoFitText = ({
	text,
	color,
	fontWeight = "normal"
}: AutoFitTextProps) => {
	const outerRef = React.useRef<HTMLDivElement>(null)
	const innerRef = React.useRef<HTMLSpanElement>(null)

	const fit = React.useCallback(() => {
		const outer = outerRef.current
		const inner = innerRef.current
		if (!outer || !inner) return
		if (!text?.trim()) {
			inner.style.fontSize = ""
			return
		}

		const w = outer.clientWidth
		const h = outer.clientHeight
		if (!w || !h) return

		let lo = 1
		let hi = Math.ceil(h * 2)
		while (hi - lo > 1) {
			const mid = Math.round((lo + hi) / 2)
			inner.style.fontSize = `${mid}px`
			const r = inner.getBoundingClientRect()
			if (r.width <= w && r.height <= h) lo = mid
			else hi = mid
		}
		inner.style.fontSize = `${lo}px`
	}, [text])

	React.useLayoutEffect(() => {
		fit()
	}, [fit])

	React.useEffect(() => {
		const outer = outerRef.current
		if (!outer) return
		const ro = new ResizeObserver(fit)
		ro.observe(outer)
		return () => {
			ro.disconnect()
		}
	}, [fit])

	return (
		<div
			ref={outerRef}
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
				boxSizing: "border-box"
			}}
		>
			<span
				ref={innerRef}
				style={{
					color,
					fontWeight,
					lineHeight: 1.15,
					textAlign: "center",
					wordBreak: "break-word",
					maxWidth: "100%",
					display: "block"
				}}
			>
				{text}
			</span>
		</div>
	)
}

// ── AutoFitMiddle ─────────────────────────────────────────────────────────────
// Middle section: optional icon to the left of text, both scaled together.

interface AutoFitMiddleProps {
	text: string
	color: string
	icon?: { svg: string; properties?: { color?: string; size?: number } }
	iconPosition?: "left" | "right"
	fontWeight?: string | number
}

const AutoFitMiddle = ({
	text,
	color,
	icon,
	iconPosition = "left",
	fontWeight = 700
}: AutoFitMiddleProps) => {
	const outerRef = React.useRef<HTMLDivElement>(null)
	const innerRef = React.useRef<HTMLSpanElement>(null)
	const [iconSize, setIconSize] = React.useState(0)
	const GAP = 8

	const fit = React.useCallback(() => {
		const outer = outerRef.current
		const inner = innerRef.current
		if (!outer || !inner) return
		if (!text?.trim()) {
			inner.style.fontSize = ""
			setIconSize(0)
			return
		}

		const W = outer.clientWidth
		const H = outer.clientHeight
		if (!W || !H) return

		const hasIcon = !!icon?.svg

		let lo = 1
		let hi = Math.ceil(H * 2)

		while (hi - lo > 1) {
			const mid = Math.round((lo + hi) / 2)
			inner.style.fontSize = `${mid}px`
			const r = inner.getBoundingClientRect()
			const totalW = hasIcon ? mid + GAP + r.width : r.width
			if (totalW <= W && r.height <= H) lo = mid
			else hi = mid
		}

		inner.style.fontSize = `${lo}px`
		if (hasIcon) setIconSize(lo)
	}, [text, icon?.svg])

	React.useLayoutEffect(() => {
		fit()
	}, [fit])

	React.useEffect(() => {
		const outer = outerRef.current
		if (!outer) return
		const ro = new ResizeObserver(fit)
		ro.observe(outer)
		return () => {
			ro.disconnect()
		}
	}, [fit])

	const iconEl = icon?.svg && iconSize > 0 && (
		<span style={{ flexShrink: 0, lineHeight: 0, color }}>
			<Icon
				icon={icon.svg}
				size={iconSize}
				color={icon.properties?.color || color}
			/>
		</span>
	)

	return (
		<div
			ref={outerRef}
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: iconPosition === "right" ? "row-reverse" : "row",
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
				boxSizing: "border-box",
				gap: icon?.svg ? GAP : 0
			}}
		>
			{iconEl}
			<span
				ref={innerRef}
				style={{
					color,
					fontWeight,
					lineHeight: 1.15,
					textAlign: icon?.svg ? (iconPosition === "right" ? "right" : "left") : "center",
					wordBreak: "break-word",
					display: "block",
					whiteSpace: icon?.svg ? "nowrap" : "normal"
				}}
			>
				{text}
			</span>
		</div>
	)
}

// ── Query helpers ─────────────────────────────────────────────────────────────

async function queryStatValue(
	ds: ArcGISQueriableDataSource,
	field: string | undefined,
	statisticType: string,
	configWhere: string
): Promise<number | null> {
	try {
		const opts = { scope: QScope.InRuntimeView as QueryScope }
		if (statisticType === "count") {
			const result = await ds.queryCount(
				{ where: configWhere } as ArcGISQueryParams,
				opts
			)
			return (result as any).count ?? null
		}
		if (!field) return null
		const result = await ds.query(
			{
				where: configWhere,
				outStatistics: [
					{
						statisticType,
						onStatisticField: field,
						outStatisticFieldName: "result"
					} as StatisticDefinition
				]
			} as ArcGISQueryParams,
			opts
		)
		const records = (result as any).records ?? []
		if (records.length > 0) {
			const data: { [key: string]: any } = records[0].getData?.() ?? {}
			const val = data.result ?? Object.values(data)[0]
			return typeof val === "number" ? val : null
		}
		return null
	} catch (err) {
		console.warn("Indicator: stats query failed", err)
		return null
	}
}

async function queryFeatureVal(
	ds: ArcGISQueriableDataSource,
	field: string,
	configWhere: string
): Promise<number | null> {
	try {
		const opts = { scope: QScope.InRuntimeView as QueryScope }
		const result = await ds.query(
			{ where: configWhere, outFields: [field], num: 1 } as ArcGISQueryParams,
			opts
		)
		const records = (result as any).records ?? []
		if (records.length > 0) {
			const val = records[0].getData?.()?.[field]
			return typeof val === "number" ? val : null
		}
		return null
	} catch (err) {
		console.warn("Indicator: feature query failed", err)
		return null
	}
}

function getConfigWhere(ds: ArcGISQueriableDataSource, expr: any): string {
	if (!expr) return "1=1"
	try {
		return dataSourceUtils.getArcGISSQL(expr, ds as any)?.sql || "1=1"
	} catch {
		return "1=1"
	}
}

// ── Widget ────────────────────────────────────────────────────────────────────

const Widget = (props: AllWidgetProps<IMConfig>) => {
	const { config, useDataSources } = props

	const [mainValue, setMainValue] = React.useState<number | null>(null)
	const [refValue, setRefValue] = React.useState<number | null>(null)
	const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null)
	const [loading, setLoading] = React.useState(false)

	const prevMainValueRef = React.useRef<number | null>(null)
	const [mainTrigger, setMainTrigger] = React.useState(0)
	const [refTrigger, setRefTrigger] = React.useState(0)

	const mainDsRef = React.useRef<ArcGISQueriableDataSource | null>(null)
	const refDsRef = React.useRef<ArcGISQueriableDataSource | null>(null)

	// Fields are stored in useDataSources[n].fields by the FieldSelector in settings
	const indField = useDataSources?.[0]?.fields?.[0]
	const refField = useDataSources?.[1]?.fields?.[0] ?? indField

	// ── Main query ─────────────────────────────────────────────────────────

	React.useEffect(() => {
		const ds = mainDsRef.current
		if (!ds) return
		const configWhere = getConfigWhere(ds, config.indQuery)
		setLoading(true)
		const run = async () => {
			let val: number | null = null
			try {
				if (config.indType === "Feature") {
					if (indField) val = await queryFeatureVal(ds, indField, configWhere)
				} else {
					val = await queryStatValue(
						ds,
						indField,
						config.mainStatisticType || "count",
						configWhere
					)
				}
			} finally {
				prevMainValueRef.current = mainValue
				setMainValue(val)
				setLastUpdate(new Date())
				setLoading(false)
			}
		}
		run()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		mainTrigger,
		indField,
		config.indType,
		config.mainStatisticType,
		config.indQuery
	])

	// ── Reference query ────────────────────────────────────────────────────

	React.useEffect(() => {
		if (!config.refType || config.refType === "none") {
			setRefValue(null)
			return
		}
		if (config.refType === "FixedValue") {
			setRefValue(config.refFixedValue ?? null)
			return
		}
		if (config.refType === "PreviousValue") {
			setRefValue(prevMainValueRef.current)
			return
		}

		const ds = refDsRef.current ?? mainDsRef.current
		if (!ds) return
		const configWhere = getConfigWhere(ds, config.refQuery)
		const run = async () => {
			let val: number | null = null
			if (config.refType === "Feature") {
				if (refField) val = await queryFeatureVal(ds, refField, configWhere)
			} else {
				val = await queryStatValue(
					ds,
					refField,
					config.refStatisticType || "count",
					configWhere
				)
			}
			setRefValue(val)
		}
		run()
	}, [
		refTrigger,
		refField,
		config.refType,
		config.refStatisticType,
		config.refFixedValue,
		config.refQuery,
		mainValue
	])

	// ── Computed values ────────────────────────────────────────────────────

	const computed = React.useMemo(
		() => computeAllValues(mainValue, refValue),
		[mainValue, refValue]
	)
	const exprValues = React.useMemo(
		() => buildExpressionValues(computed, config as any),
		[computed, config]
	)
	const topText = resolveExpressions(config.topText, exprValues)
	const middleText = resolveExpressions(config.middleText, exprValues)
	const bottomText = resolveExpressions(config.bottomText, exprValues)

	// ── DataSource handlers ────────────────────────────────────────────────

	const handleMainDsCreated = React.useCallback((ds: DataSource) => {
		mainDsRef.current = ds as ArcGISQueriableDataSource
		setMainTrigger((v) => v + 1)
	}, [])
	const handleRefDsCreated = React.useCallback((ds: DataSource) => {
		refDsRef.current = ds as ArcGISQueriableDataSource
		setRefTrigger((v) => v + 1)
	}, [])
	const handleMainQueryRequired = React.useCallback(() => {
		setMainTrigger((v) => v + 1)
	}, [])
	const handleRefQueryRequired = React.useCallback(() => {
		setRefTrigger((v) => v + 1)
	}, [])

	// ── Layout ─────────────────────────────────────────────────────────────

	const topGrow = fontSizeToFlexGrow(config.topTextMaxSize)
	const middleGrow = fontSizeToFlexGrow(config.middleTextMaxSize)
	const bottomGrow = fontSizeToFlexGrow(config.bottomTextMaxSize)
	const showRef = config.refType && config.refType !== "none"
	const isConfigured = !!useDataSources?.[0]

	// ── Relative time helper ───────────────────────────────────────────────

	const relativeTime = (date: Date): string => {
		const diff = Math.floor((Date.now() - date.getTime()) / 1000)
		if (diff < 60) return "Updated just now"
		if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`
		if (diff < 86400) return `Updated ${Math.floor(diff / 3600)}h ago`
		return `Updated ${date.toLocaleDateString()}`
	}

	// ── Render ─────────────────────────────────────────────────────────────

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				boxSizing: "border-box",
				padding: "8px 12px 4px 12px",
				position: "relative"
			}}
		>
			{/* DataSource listeners */}
			<DataSourceComponent
				useDataSource={useDataSources?.[0]}
				widgetId={props.id}
				onDataSourceCreated={handleMainDsCreated}
				onQueryRequired={handleMainQueryRequired}
			/>
			{showRef && useDataSources?.[1] && (
				<DataSourceComponent
					useDataSource={useDataSources[1]}
					widgetId={props.id + "_ref"}
					onDataSourceCreated={handleRefDsCreated}
					onQueryRequired={handleRefQueryRequired}
				/>
			)}

			{/* ── Not configured placeholder ── */}
			{!isConfigured && (
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
						opacity: 0.45
					}}
				>
					<svg
						width="40"
						height="40"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<path d="M9 9h6M9 12h6M9 15h4" />
					</svg>
					<span style={{ fontSize: 13, textAlign: "center" }}>
						Connect a data source
						<br />
						in the settings panel
					</span>
				</div>
			)}

			{/* ── Loading overlay ── */}
			{isConfigured && loading && mainValue === null && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "transparent",
						zIndex: 2,
						opacity: 0.5
					}}
				>
					<Spinner />
				</div>
			)}

			{/* ── Content ── */}
			{isConfigured && (
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
						opacity: loading && mainValue === null ? 0 : 1,
						transition: "opacity 0.2s"
					}}
				>
					{config.topText ? (
						<div
							style={{
								flex: `${topGrow} ${topGrow} 0`,
								minHeight: 0,
								overflow: "hidden"
							}}
						>
							<AutoFitText
								text={topText}
								color={config.topTextColor || "inherit"}
								fontWeight="normal"
							/>
						</div>
					) : null}

					{config.middleText ? (
						<div
							style={{
								flex: `${middleGrow} ${middleGrow} 0`,
								minHeight: 0,
								overflow: "hidden"
							}}
						>
							<AutoFitMiddle
								text={middleText}
								color={config.middleTextColor || "inherit"}
								icon={config.icon}
								iconPosition={config.iconPosition ?? "left"}
								fontWeight={700}
							/>
						</div>
					) : null}

					{config.bottomText ? (
						<div
							style={{
								flex: `${bottomGrow} ${bottomGrow} 0`,
								minHeight: 0,
								overflow: "hidden"
							}}
						>
							<AutoFitText
								text={bottomText}
								color={config.bottomTextColor || "inherit"}
								fontWeight="normal"
							/>
						</div>
					) : null}
				</div>
			)}

			{/* ── Last update timestamp ── */}
			{config.showLastUpdateTime && lastUpdate && (
				<div
					style={{
						flexShrink: 0,
						textAlign: "right",
						fontSize: 10,
						lineHeight: 1.4,
						color: config.lastUpdateTimeTextColor || "currentColor",
						opacity: 0.6,
						paddingTop: 2,
						letterSpacing: "0.02em"
					}}
				>
					{relativeTime(lastUpdate)}
				</div>
			)}
		</div>
	)
}

export default Widget
