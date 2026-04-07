import {
	React,
	type AllWidgetProps,
	DataSourceComponent,
	type DataSource,
	type ArcGISQueriableDataSource
} from "jimu-core"
import { Icon, Paper } from "jimu-ui"
import type { IMConfig } from "../config"
import {
	computeAllValues,
	buildExpressionValues,
	resolveExpressions,
	fontSizeToFlexGrow,
	getActiveStyles,
	relativeTime
} from "./utils"
import {
	getConfigWhere,
	queryStatValue,
	queryFeatureFieldValues
} from "./queries"

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
					textAlign: icon?.svg
						? iconPosition === "right"
							? "right"
							: "left"
						: "center",
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

// ── FeaturePager ──────────────────────────────────────────────────────────────

interface FeaturePagerProps {
	current: number
	total: number
	onPrev: () => void
	onNext: () => void
}

const FeaturePager = ({
	current,
	total,
	onPrev,
	onNext
}: FeaturePagerProps) => {
	const btnStyle: React.CSSProperties = {
		background: "none",
		border: "none",
		cursor: "pointer",
		fontSize: 14,
		fontWeight: 700,
		lineHeight: 1,
		padding: "2px 6px",
		color: "inherit",
		opacity: 0.7
	}
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 4,
				flexShrink: 0,
				padding: "2px 0",
				fontSize: 13,
				userSelect: "none"
			}}
		>
			<button style={btnStyle} onClick={onPrev} aria-label="Previous feature">
				{"<"}
			</button>
			<span>
				{current + 1}/{total}
			</span>
			<button style={btnStyle} onClick={onNext} aria-label="Next feature">
				{">"}
			</button>
		</div>
	)
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function Widget (props: AllWidgetProps<IMConfig>) {
	const { config, useDataSources } = props

	// ── State ──────────────────────────────────────────────────────────────

	const [statValue, setStatValue] = React.useState<number | null>(null)
	const [statRefValue, setStatRefValue] = React.useState<number | null>(null)
	const [featureMainValues, setFeatureMainValues] = React.useState<
		Array<number | null>
	>([])
	const [featureRefValues, setFeatureRefValues] = React.useState<
		Array<number | null>
	>([])
	const [featureIndex, setFeatureIndex] = React.useState(0)
	const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null)
	const [loading, setLoading] = React.useState(false)
	const [mainTrigger, setMainTrigger] = React.useState(0)
	const [refTrigger, setRefTrigger] = React.useState(0)

	// ── Refs ───────────────────────────────────────────────────────────────

	const mainDsRef = React.useRef<ArcGISQueriableDataSource | null>(null)
	const refDsRef = React.useRef<ArcGISQueriableDataSource | null>(null)
	const prevMainValueRef = React.useRef<number | null>(null)

	// ── Derived fields ─────────────────────────────────────────────────────

	const indField = useDataSources?.[0]?.fields?.[0]
	// Feature+Feature ref → useDataSources[0].fields[1] (same DS, second field)
	// Otherwise → useDataSources[1].fields[0] (separate DS for Statistic ref)
	const refField =
		config.indType === "Feature" && config.refType === "Feature"
			? (useDataSources?.[0]?.fields?.[1] ?? indField)
			: (useDataSources?.[1]?.fields?.[0] ?? indField)

	// ── Derived values ─────────────────────────────────────────────────────

	const isFeatureMode = config.indType === "Feature"
	const featureCount = featureMainValues.length
	const isConfigured = !!useDataSources?.[0]
	const showRef = config.refType && config.refType !== "none"

	const mainValue =
		isFeatureMode && featureCount > 0
			? (featureMainValues[featureIndex] ?? null)
			: statValue
	const refValue =
		isFeatureMode && config.refType === "Feature" && featureRefValues.length > 0
			? (featureRefValues[featureIndex] ?? null)
			: statRefValue

	// ── Computed / formatted values ────────────────────────────────────────

	const computed = React.useMemo(
		() => computeAllValues(mainValue, refValue),
		[mainValue, refValue]
	)
	const exprValues = React.useMemo(
		() => buildExpressionValues(computed, config as any),
		[computed, config]
	)

	const isBelow =
		config.conditionalFormat &&
		mainValue !== null &&
		refValue !== null &&
		mainValue < refValue

	const styles = getActiveStyles(config as any, isBelow)

	const topText = resolveExpressions(styles.topText, exprValues)
	const middleText = resolveExpressions(styles.middleText, exprValues)
	const bottomText = resolveExpressions(styles.bottomText, exprValues)

	const topGrow = fontSizeToFlexGrow(styles.topTextMaxSize)
	const middleGrow = fontSizeToFlexGrow(styles.middleTextMaxSize)
	const bottomGrow = fontSizeToFlexGrow(styles.bottomTextMaxSize)

	// ── Callbacks ──────────────────────────────────────────────────────────

	const handleMainDsCreated = React.useCallback((ds: DataSource) => {
		mainDsRef.current = ds as unknown as ArcGISQueriableDataSource
		setMainTrigger((v) => v + 1)
	}, [])
	const handleRefDsCreated = React.useCallback((ds: DataSource) => {
		refDsRef.current = ds as unknown as ArcGISQueriableDataSource
		setRefTrigger((v) => v + 1)
	}, [])
	const handleMainQueryRequired = React.useCallback(() => {
		setMainTrigger((v) => v + 1)
	}, [])
	const handleRefQueryRequired = React.useCallback(() => {
		setRefTrigger((v) => v + 1)
	}, [])
	const handlePrevFeature = React.useCallback(() => {
		setFeatureIndex((prev) => (prev <= 0 ? featureCount - 1 : prev - 1))
	}, [featureCount])
	const handleNextFeature = React.useCallback(() => {
		setFeatureIndex((prev) => (prev >= featureCount - 1 ? 0 : prev + 1))
	}, [featureCount])

	// ── Main query effect ──────────────────────────────────────────────────

	React.useEffect(() => {
		const ds = mainDsRef.current
		if (!ds) return
		const configWhere = getConfigWhere(ds, config.indQuery)
		setLoading(true)
		const run = async () => {
			try {
				if (config.indType === "Feature") {
					if (indField) {
						const fields =
							refField && refField !== indField
								? [indField, refField]
								: [indField]
						const result = await queryFeatureFieldValues(
							ds,
							fields,
							configWhere
						)
						prevMainValueRef.current = mainValue
						setFeatureMainValues(result[indField] ?? [])
						setFeatureRefValues(result[refField ?? indField] ?? [])
						const count = (result[indField] ?? []).length
						setFeatureIndex((prev) => (prev >= count ? 0 : prev))
					} else {
						prevMainValueRef.current = mainValue
						setFeatureMainValues([])
					}
				} else {
					const val = await queryStatValue(
						ds,
						indField,
						config.mainStatisticType || "count",
						configWhere
					)
					prevMainValueRef.current = mainValue
					setStatValue(val)
				}
			} finally {
				setLastUpdate(new Date())
				setLoading(false)
			}
		}
		run()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		mainTrigger,
		indField,
		refField,
		config.indType,
		config.mainStatisticType,
		config.indQuery
	])

	// ── Reference query effect ─────────────────────────────────────────────

	React.useEffect(() => {
		if (!config.refType || config.refType === "none") {
			setStatRefValue(null)
			setFeatureRefValues([])
			return
		}
		if (config.indType === "Feature" && config.refType === "Feature") {
			return
		}
		if (config.refType === "FixedValue") {
			setStatRefValue(config.refFixedValue ?? null)
			return
		}
		if (config.refType === "PreviousValue") {
			setStatRefValue(prevMainValueRef.current)
			return
		}

		const ds = refDsRef.current ?? mainDsRef.current
		if (!ds) return
		const configWhere = getConfigWhere(ds, config.refQuery)
		const run = async () => {
			if (config.refType === "Feature") {
				if (refField) {
					const result = await queryFeatureFieldValues(
						ds,
						[refField],
						configWhere
					)
					setFeatureRefValues(result[refField] ?? [])
				} else {
					setFeatureRefValues([])
				}
			} else {
				const val = await queryStatValue(
					ds,
					refField,
					config.refStatisticType || "count",
					configWhere
				)
				setStatRefValue(val)
			}
		}
		run()
	}, [
		refTrigger,
		refField,
		config.indType,
		config.refType,
		config.refStatisticType,
		config.refFixedValue,
		config.refQuery,
		mainValue
	])

	// ── Render ─────────────────────────────────────────────────────────────

	return (
		<Paper
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
					{styles.topText ? (
						<div
							style={{
								flex: `${topGrow} ${topGrow} 0`,
								minHeight: 0,
								overflow: "hidden"
							}}
						>
							<AutoFitText
								text={topText}
								color={styles.topTextColor || "inherit"}
								fontWeight="normal"
							/>
						</div>
					) : null}

					{styles.middleText ? (
						<div
							style={{
								flex: `${middleGrow} ${middleGrow} 0`,
								minHeight: 0,
								overflow: "hidden"
							}}
						>
							<AutoFitMiddle
								text={middleText}
								color={styles.middleTextColor || "inherit"}
								icon={styles.icon}
								iconPosition={config.iconPosition ?? "left"}
								fontWeight={700}
							/>
						</div>
					) : null}

					{styles.bottomText ? (
						<div
							style={{
								flex: `${bottomGrow} ${bottomGrow} 0`,
								minHeight: 0,
								overflow: "hidden"
							}}
						>
							<AutoFitText
								text={bottomText}
								color={styles.bottomTextColor || "inherit"}
								fontWeight="normal"
							/>
						</div>
					) : null}
				</div>
			)}

			{/* ── Feature pager ── */}
			{isFeatureMode && featureCount > 1 && (
				<FeaturePager
					current={featureIndex}
					total={featureCount}
					onPrev={handlePrevFeature}
					onNext={handleNextFeature}
				/>
			)}

			{/* ── Last update timestamp ── */}
			{config.showLastUpdateTime && lastUpdate && (
				<div
					style={{
						flexShrink: 0,
						textAlign: "left",
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
		</Paper>
	)
}
