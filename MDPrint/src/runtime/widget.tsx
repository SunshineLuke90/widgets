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
import {
	Button,
	CollapsablePanel,
	Icon,
	Modal,
	ModalBody,
	ModalHeader,
	Paper,
	TextArea
} from "jimu-ui"
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

	// Modal state for markdown editor
	const [mdModalOpen, setMdModalOpen] = React.useState(false)
	const openMDModal = () => {
		setMdModalOpen(true)
	}
	const closeMDModal = () => {
		setMdModalOpen(false)
	}

	// Modal state for css editor
	const [cssModalOpen, setCssModalOpen] = React.useState(false)
	const openCSSModal = () => {
		setCssModalOpen(true)
	}
	const closeCSSModal = () => {
		setCssModalOpen(false)
	}

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
				<span style={{ fontSize: "14px" }}>Template</span>
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
									<div className="mdprint-field-header">
										<div className="label">Markdown Content</div>
										<Button
											icon={true}
											className="expand-button"
											size="sm"
											variant="text"
											onClick={openMDModal}
										>
											<Icon
												size="m"
												icon='<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16"><path d="M15 15h-4v-1h2.282l-3.633-3.584.767-.767L14 13.282V11h1zM5 1v1H2.718l3.633 3.584-.767.767L2 2.718V5H1V1z"></path></svg>'
											></Icon>
										</Button>
										<Modal
											centered
											keyboard
											scrollable
											toggle={closeMDModal}
											isOpen={mdModalOpen}
											onRequestClose={closeMDModal}
										>
											<ModalHeader toggle={closeMDModal}>
												Markdown Content
											</ModalHeader>
											<ModalBody>
												<TextArea
													height={window.innerHeight * 0.8}
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
											</ModalBody>
										</Modal>
									</div>
									<TextArea
										value={currentMarkdown}
										height={100}
										onChange={(e) => {
											const val = e.currentTarget.value
											setMarkdownOverrides((prev) => ({
												...prev,
												[template.id]: val
											}))
										}}
										placeholder="Enter markdown content here"
									/>
									<div className="mdprint-field-header">
										<div className="label">Custom CSS</div>
										<Button
											icon={true}
											className="expand-button"
											size="sm"
											variant="text"
											onClick={openCSSModal}
										>
											<Icon
												size="m"
												icon='<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16"><path d="M15 15h-4v-1h2.282l-3.633-3.584.767-.767L14 13.282V11h1zM5 1v1H2.718l3.633 3.584-.767.767L2 2.718V5H1V1z"></path></svg>'
											></Icon>
										</Button>
										<Modal
											centered
											keyboard
											scrollable
											toggle={closeCSSModal}
											isOpen={cssModalOpen}
											onRequestClose={closeCSSModal}
										>
											<ModalHeader toggle={closeCSSModal}>
												CSS Content
											</ModalHeader>
											<ModalBody>
												<TextArea
													height={window.innerHeight * 0.8}
													value={currentCss}
													onChange={(e) => {
														const val = e.currentTarget.value
														setCssOverrides((prev) => ({
															...prev,
															[template.id]: val
														}))
													}}
													placeholder="Enter CSS content here"
												/>
											</ModalBody>
										</Modal>
									</div>
									<TextArea
										value={currentCss}
										height={100}
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
				appearance="solid"
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
				Print {selectedCount > 0 ? `(${selectedCount} selected)` : ""}
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
