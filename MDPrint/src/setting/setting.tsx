import {
	React,
	Immutable,
	type UseDataSource,
	DataSourceTypes,
	utils,
	type ImmutableObject
} from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import { Button, TextInput, Tabs, Tab, TextArea } from "jimu-ui"
import { SettingRow, SettingSection } from "jimu-ui/advanced/setting-components"
import { DataSourceSelector } from "jimu-ui/advanced/data-source-selector"
import type { IMConfig, PrintTemplate } from "../config"

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
	const { id, config } = props
	const [activeTab, setActiveTab] = React.useState<string | undefined>(
		config?.PrintTemplates?.[0]?.id
	)

	// helper to get a mutable copy of templates
	const getTemplates = () =>
		config?.PrintTemplates
			? config.PrintTemplates.asMutable({ deep: true })
			: []

	const updateTemplate = (templateId: string, newData: Partial<any>) => {
		const arr = getTemplates()
		const index = arr.findIndex((template: any) => template.id === templateId)
		if (index === -1) return
		arr[index] = { ...arr[index], ...newData }
		const newConfig = (config || Immutable({})).set("PrintTemplates", arr)
		props.onSettingChange({ id, config: newConfig })
	}

	const addPrintTemplate = () => {
		const newTemplate = {
			id: `${id}-template-${utils.getUUID()}`,
			label: `Template ${config?.PrintTemplates?.length + 1 || 1}`,
			markdown:
				"# Markdown Title\n\nThis is an example of markdown content in the MDPrint widget. You can use **bold**, *italic*, and other markdown syntax to format your content.\n\n- Item 1\n- Item 2\n- Item 3\n\n[ArcGIS Experience Builder](https://experience.arcgis.com/)",
			css: ".markdown-content {\n  font-family: 'Noto Sans', Arial, Helvetica, sans-serif;\n  color: #333;\n}\n\n.markdown-content h1 {\n  color: #0078d4;\n}\n\n.markdown-content a {\n  color: #0078d4;\n  text-decoration: none;\n}\n\n.markdown-content a:hover {\n  text-decoration: underline;\n}"
		}
		const arr = getTemplates()
		arr.push(newTemplate)
		const newConfig = (config || Immutable({})).set("PrintTemplates", arr)
		props.onSettingChange({ id, config: newConfig })
	}

	const removePrintTemplate = (templateId: string) => {
		const arr = getTemplates().filter((t: any) => t.id !== templateId)
		const newConfig = (config || Immutable({})).set("PrintTemplates", arr)
		props.onSettingChange({ id, config: newConfig })
	}
	/*
	const onDataSourceChange = (useDataSources: UseDataSource[]) => {
		props.onSettingChange({
			id: props.id,
			useDataSources: useDataSources
		})
	}
*/
	return (
		<div>
			<SettingSection title="Markdown Print Setup">
				<SettingRow level={1} flow="wrap">
					<Button type="secondary" onClick={addPrintTemplate}>
						Add Print Template
					</Button>
				</SettingRow>
				<SettingRow level={1} flow="wrap">
					{config?.PrintTemplates && config.PrintTemplates.length > 0 && (
						<Tabs
							value={activeTab}
							onChange={(id) => {
								setActiveTab(id)
							}}
							type="tabs"
							scrollable={true}
							keepMount
							style={{ margin: "0 8px" }}
							onClose={(id) => {
								removePrintTemplate(id)
							}}
							children={
								config.PrintTemplates.map(
									(template: ImmutableObject<PrintTemplate>) => (
										<Tab
											id={template.id}
											key={template.id}
											title={template.label}
											closeable
										>
											<SettingRow label="Template Name" level={1} flow="wrap">
												<TextInput
													value={template.label}
													onChange={(e) => {
														updateTemplate(template.id, {
															label: e.currentTarget.value
														})
													}}
												/>
											</SettingRow>
											<SettingRow
												label="Select Data Source"
												level={1}
												flow="wrap"
											>
												<DataSourceSelector
													types={Immutable([DataSourceTypes.FeatureLayer])}
													mustUseDataSource={true}
													isMultiple={false}
													useDataSources={template.useDataSources}
													useDataSourcesEnabled={props.useDataSourcesEnabled}
													onChange={(uds: UseDataSource[]) => {
														updateTemplate(template.id, { useDataSources: uds })
													}}
													widgetId={props.id}
												/>
											</SettingRow>
											<SettingRow
												label="Markdown Content"
												level={2}
												flow="wrap"
											>
												<TextArea
													value={template.markdown}
													onChange={(e) => {
														updateTemplate(template.id, {
															markdown: e.currentTarget.value
														})
													}}
													placeholder="Enter markdown content here"
												/>
											</SettingRow>
											<SettingRow label="Custom CSS" level={2} flow="wrap">
												<TextArea
													value={template.css}
													onChange={(e) => {
														updateTemplate(template.id, {
															css: e.currentTarget.value
														})
													}}
													placeholder="Enter custom CSS here"
												/>
											</SettingRow>
										</Tab>
									)
								) as any
							}
						/>
					)}
				</SettingRow>
				{!config?.PrintTemplates || config.PrintTemplates.length === 0 ? (
					<div>
						No print templates configured. Click "Add Print Template" to create
						one.
					</div>
				) : null}
			</SettingSection>
		</div>
	)
}
