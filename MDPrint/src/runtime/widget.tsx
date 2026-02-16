import {
	type DataSource,
	DataSourceComponent,
	type FeatureLayerQueryParams,
	React,
	type AllWidgetProps,
	type DataRecord,
	type ImmutableObject,
	Immutable
} from "jimu-core"
import type { IMConfig, PrintTemplate } from "../config"
import { CollapsablePanel, Paper, TextArea } from "jimu-ui"
import {
	CalciteAlert,
	CalciteButton,
	CalciteOption,
	CalciteSelect
} from "calcite-components"
import { handlePrint } from "./formatUtils"
import "./style.css"

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
	const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>(
		config?.PrintTemplates?.[0]?.id || ""
	)

	// Runtime overrides for markdown and css, keyed by template ID
	const [markdownOverrides, setMarkdownOverrides] = React.useState<{
		[templateId: string]: string
	}>({})
	const [cssOverrides, setCssOverrides] = React.useState<{
		[templateId: string]: string
	}>({})

	// Alert state
	const [alertOpen, setAlertOpen] = React.useState(false)
	const [alertMessage, setAlertMessage] = React.useState("")

	const showAlert = (message: string) => {
		setAlertMessage(message)
		setAlertOpen(true)
	}

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

	const doPrint = (template: ImmutableObject<PrintTemplate>) => {
		const dsId = getDsIdForTemplate(template)
		if (!dsId || !datasources[dsId]) {
			showAlert("No data source available for this template.")
			return
		}
		const records = selectedByDsId[dsId] || []

		// Use runtime overrides if present, otherwise fall back to config values
		const markdown =
			markdownOverrides[template.id] !== undefined
				? markdownOverrides[template.id]
				: template.markdown
		const css =
			cssOverrides[template.id] !== undefined
				? cssOverrides[template.id]
				: template.css

		const result = handlePrint(records, markdown, css)
		if (result !== "Success") {
			showAlert(result)
		}
	}

	// Count of selected features for the currently active template
	const selectedCount = React.useMemo(() => {
		const template = config?.PrintTemplates?.find(
			(t) => t.id === selectedTemplateId
		)
		if (!template) return 0
		const dsId = template.useDataSources?.[0]?.dataSourceId
		if (!dsId) return 0
		return (selectedByDsId[dsId] || []).length
	}, [config?.PrintTemplates, selectedTemplateId, selectedByDsId])

	if (!isConfigured) {
		return (
			<Paper
				variant="flat"
				shape="none"
				className="widget-mdprint jimu-widget"
				style={{ whiteSpace: "pre-wrap", padding: "16px" }}
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
			style={{ whiteSpace: "pre-wrap" }}
		>
			<header className="widget-header">
				<h4>Markdown Printer</h4>
			</header>
			<div className="mdprint-scroll">
				Template
				<CalciteSelect
					label="Select Print Template"
					scale="s"
					value={selectedTemplateId}
					onCalciteSelectChange={(e: any) => {
						const templateId = (e.target as HTMLCalciteSelectElement).value
						setSelectedTemplateId(templateId)
					}}
				>
					{config.PrintTemplates.map(
						(template: ImmutableObject<PrintTemplate>) => {
							const records = getSelectedRecordsForTemplate(template)
							return (
								<CalciteOption key={template.id} value={template.id}>
									{template.label +
										(records.length > 0 ? ` (${records.length} selected)` : "")}
								</CalciteOption>
							)
						}
					)}
				</CalciteSelect>
				{/* Show markdown and CSS editors for the currently selected template */}
				{selectedTemplateId &&
					config.PrintTemplates.map(
						(template: ImmutableObject<PrintTemplate>) => {
							if (template.id !== selectedTemplateId) return null
							const currentMarkdown =
								markdownOverrides[template.id] !== undefined
									? markdownOverrides[template.id]
									: template.markdown
							const currentCss =
								cssOverrides[template.id] !== undefined
									? cssOverrides[template.id]
									: template.css
							return (
								<CollapsablePanel
									key={template.id}
									label="Edit Template"
									defaultIsOpen={false}
									level={3}
								>
									<div style={{ fontWeight: 400, margin: "8px 0 0 0" }}>
										Markdown Content
									</div>
									<TextArea
										value={currentMarkdown}
										onChange={(e) => {
											const val = e.currentTarget.value
											setMarkdownOverrides((prev) => ({
												...prev,
												[template.id]: val
											}))
										}}
										placeholder="Enter markdown content here"
									/>
									<div style={{ fontWeight: 400, margin: "8px 0 0 0" }}>
										Custom CSS
									</div>
									<TextArea
										value={currentCss}
										onChange={(e) => {
											const val = e.currentTarget.value
											setCssOverrides((prev) => ({
												...prev,
												[template.id]: val
											}))
										}}
										placeholder="Enter custom CSS here"
									/>
								</CollapsablePanel>
							)
						}
					)}
			</div>

			<CalciteButton
				appearance="outline"
				disabled={!selectedTemplateId || selectedCount === 0}
				style={{ marginTop: "8px" }}
				className="print-button"
				onClick={() => {
					const template = config.PrintTemplates.find(
						(t) => t.id === selectedTemplateId
					)
					if (template) {
						doPrint(Immutable(template))
					}
				}}
			>
				Print
			</CalciteButton>
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
			<CalciteAlert
				open={alertOpen || undefined}
				kind="danger"
				icon="exclamation-mark-triangle"
				autoClose
				autoCloseDuration="medium"
				label="Error alert"
				onCalciteAlertClose={() => {
					setAlertOpen(false)
				}}
			>
				<div slot="title">Error</div>
				<div slot="message">{alertMessage}</div>
			</CalciteAlert>
		</Paper>
	)
}
