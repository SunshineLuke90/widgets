import {
	type DataSource,
	DataSourceComponent,
	type FeatureLayerQueryParams,
	React,
	type AllWidgetProps,
	type DataRecord,
	type ImmutableObject
} from "jimu-core"
import type { IMConfig, PrintTemplate } from "../config"
import { Paper } from "jimu-ui"
import { CalciteButton } from "calcite-components"
import { applyFormat } from "./formatUtils"
import DOMPurify from "dompurify"
import { marked } from "marked"
import printJS from "print-js"

export default function Widget(props: AllWidgetProps<IMConfig>) {
	const { config } = props
	// Store datasources keyed by datasource ID to avoid duplicates
	const [datasources, setDatasources] = React.useState<{
		[dsId: string]: DataSource
	}>({})
	// Store selected records keyed by datasource ID
	const [selectedByDsId, setSelectedByDsId] = React.useState<{
		[dsId: string]: DataRecord[]
	}>({})

	const isConfigured =
		config?.PrintTemplates &&
		config.PrintTemplates.length > 0 &&
		config.PrintTemplates.some(
			(t) => t.useDataSources && t.useDataSources.length > 0
		)

	// Collect unique useDataSources across all templates (deduplicated by dataSourceId)
	const uniqueUseDataSources = React.useMemo(() => {
		if (!config?.PrintTemplates) return []
		const seen = new Set<string>()
		const result = []
		for (const template of config.PrintTemplates) {
			if (template.useDataSources && template.useDataSources.length > 0) {
				const uds = template.useDataSources[0]
				if (!seen.has(uds.dataSourceId)) {
					seen.add(uds.dataSourceId)
					result.push(uds)
				}
			}
		}
		return result
	}, [config?.PrintTemplates])

	// Get the datasource ID for a given template
	const getDsIdForTemplate = (
		template: ImmutableObject<PrintTemplate>
	): string | null => {
		return template.useDataSources?.[0]?.dataSourceId ?? null
	}

	// Get selected records for a given template's datasource
	const getSelectedRecordsForTemplate = (
		template: ImmutableObject<PrintTemplate>
	): DataRecord[] => {
		const dsId = getDsIdForTemplate(template)
		if (!dsId) return []
		return selectedByDsId[dsId] || []
	}

	const handlePrint = (template: ImmutableObject<PrintTemplate>) => {
		const dsId = getDsIdForTemplate(template)
		if (!dsId || !datasources[dsId]) {
			console.error("No data source available for this template")
			return
		}
		const records = selectedByDsId[dsId] || []
		if (records.length === 0) {
			console.error("No features selected for this template's data source")
			return
		}

		const pages: string[] = []
		for (const feature of records) {
			const markdownWithValues = template.markdown
			const result = markdownWithValues.replace(
				/\${(.*?)}/g,
				(_match, contents) => {
					const [fieldName, ...formatParts] = contents.split("|")
					const field = fieldName.trim()
					const format = formatParts.length
						? formatParts.join("|").trim().replace(/['"]/g, "")
						: null
					const out = applyFormat(feature.getData()[field], format) ?? ""
					return out
				}
			)
			const htmlOut = `<div class="markdown-content">${DOMPurify.sanitize(marked.parse(result, { async: false }))}</div>`
			const formattedHtml = htmlOut.replace(/\n/g, "<br>")
			pages.push(formattedHtml)
		}
		const combinedHtml = pages.join(
			'<div style="page-break-after: always;"></div>'
		)
		const cleanCss =
			"@page { margin: 20px; } " + template.css.replace(/\n/g, "")
		printJS({ printable: combinedHtml, type: "raw-html", style: cleanCss })
	}

	if (!isConfigured) {
		return (
			<Paper
				variant="flat"
				shape="none"
				className="widget-mdprint jimu-widget"
				style={{ whiteSpace: "pre-wrap", padding: "8px" }}
			>
				<p>Please configure print templates in the widget settings.</p>
			</Paper>
		)
	}

	return (
		<Paper
			variant="flat"
			shape="none"
			className="widget-mdprint jimu-widget"
			style={{ whiteSpace: "pre-wrap", padding: "8px" }}
		>
			<h4>Markdown Printer</h4>
			{config.PrintTemplates.map((template: ImmutableObject<PrintTemplate>) => {
				const records = getSelectedRecordsForTemplate(template)
				return (
					<div key={template.id} style={{ marginBottom: "8px" }}>
						<p>
							{template.label}: {records.length} selected
						</p>
						<CalciteButton
							appearance="outline"
							onClick={() => {
								handlePrint(template)
							}}
							disabled={records.length === 0}
						>
							Print {template.label}
						</CalciteButton>
					</div>
				)
			})}
			{/* Render a DataSourceComponent for each unique datasource */}
			{uniqueUseDataSources.map((uds) => (
				<DataSourceComponent
					key={uds.dataSourceId}
					useDataSource={uds}
					query={
						{
							where: "1=1",
							outFields: ["*"],
							returnGeometry: true
						} as FeatureLayerQueryParams
					}
					widgetId={props.id}
					onDataSourceCreated={(ds: DataSource) => {
						setDatasources((prev) => {
							if (prev[ds.id]) return prev
							return { ...prev, [ds.id]: ds }
						})
					}}
					onSelectionChange={() => {
						// Look up the ds from our stored datasources by the expected ID
						const ds = datasources[uds.dataSourceId]
						if (!ds) return
						const records = ds.getSelectedRecords()
						setSelectedByDsId((prev) => ({
							...prev,
							[ds.id]: records
						}))
					}}
				/>
			))}
		</Paper>
	)
}
