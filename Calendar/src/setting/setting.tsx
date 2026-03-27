import {
	React,
	Immutable,
	type UseDataSource,
	DataSourceTypes,
	utils,
	type ImmutableObject,
	css
} from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import { SettingRow, SettingSection } from "jimu-ui/advanced/setting-components"
import {
	Button,
	TextInput,
	Tabs,
	Tab,
	CollapsablePanel,
	NumericInput
} from "jimu-ui"
import type { IMConfig, colorset, data } from "../config"
import {
	DataSourceSelector,
	FieldSelector
} from "jimu-ui/advanced/data-source-selector"

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
	const { id, config } = props
	const [activeTab, setActiveTab] = React.useState<string | undefined>(
		config?.dataSets?.[0]?.id
	)

	// helper to get a mutable copy of datasets
	const getDataSets = () =>
		config?.dataSets ? config.dataSets.asMutable({ deep: true }) : []

	const updateDataset = (datasetId: string, newData: Partial<any>) => {
		const datasets = getDataSets()
		const datasetIndex = datasets.findIndex(
			(dataset: any) => dataset.id === datasetId
		)
		if (datasetIndex === -1) return
		datasets[datasetIndex] = { ...datasets[datasetIndex], ...newData }
		const newConfig = (config || Immutable({})).set("dataSets", datasets)
		props.onSettingChange({ id, config: newConfig })
	}

	const handleDataSourceChange = (
		dataset: data,
		selectedDataSources: UseDataSource[]
	) => {
		const newDataSource = selectedDataSources[0]
		const oldDataSourceId = dataset.dataSourceId

		// Remove old data source from widget-level useDataSources (if any)
		let updatedWidgetDataSources = (props.useDataSources || []).filter(
			(widgetDataSource) => widgetDataSource.dataSourceId !== oldDataSourceId
		)

		// Add the new one (if not already present from another dataset)
		if (
			newDataSource &&
			!updatedWidgetDataSources.some(
				(widgetDataSource) =>
					widgetDataSource.dataSourceId === newDataSource.dataSourceId
			)
		) {
			updatedWidgetDataSources = [...updatedWidgetDataSources, newDataSource]
		}

		// Update config: store only the dataSourceId, reset field mappings
		const datasets = getDataSets()
		const datasetIndex = datasets.findIndex((item) => item.id === dataset.id)
		if (datasetIndex !== -1) {
			datasets[datasetIndex] = {
				...datasets[datasetIndex],
				dataSourceId: newDataSource?.dataSourceId,
				labelField: undefined,
				startDateField: undefined,
				endDateField: undefined,
				allDayField: undefined,
				descriptionField: undefined,
				colorsetField: undefined,
				defaultEventColor: "#3788d8",
				colorsets: []
			}
		}

		const newConfig = (config || Immutable({})).set("dataSets", datasets)

		props.onSettingChange({
			id,
			config: newConfig,
			useDataSources: Array.isArray(updatedWidgetDataSources)
				? updatedWidgetDataSources
				: (updatedWidgetDataSources as any).asMutable({ deep: false })
		})
	}

	const addDataset = () => {
		const newDataset = {
			id: `ds_${utils.getUUID()}`,
			labelField: undefined,
			startDateField: undefined,
			endDateField: undefined,
			allDayField: undefined,
			descriptionField: undefined,
			colorsetField: undefined,
			defaultEventColor: "#3788d8",
			colorsets: [] as colorset[]
		}
		const datasets = getDataSets()
		datasets.push(newDataset)
		const newConfig = (config || Immutable({})).set("dataSets", datasets)
		props.onSettingChange({ id, config: newConfig })
	}

	const removeDataset = (datasetId: string) => {
		const toRemove = getDataSets().find((dataset) => dataset.id === datasetId)
		const remainingDatasets = getDataSets().filter(
			(dataset: any) => dataset.id !== datasetId
		)
		const newConfig = (config || Immutable({})).set(
			"dataSets",
			remainingDatasets
		)

		let updatedWidgetDataSources = props.useDataSources || []
		if (toRemove?.dataSourceId) {
			const stillUsed = remainingDatasets.some(
				(dataset) => dataset.dataSourceId === toRemove.dataSourceId
			)
			if (!stillUsed) {
				updatedWidgetDataSources = updatedWidgetDataSources.filter(
					(widgetDataSource) =>
						widgetDataSource.dataSourceId !== toRemove.dataSourceId
				)
			}
		}

		props.onSettingChange({
			id,
			config: newConfig,
			useDataSources: Array.isArray(updatedWidgetDataSources)
				? updatedWidgetDataSources
				: (updatedWidgetDataSources as any).asMutable({ deep: false })
		})
	}

	const addColorset = (datasetId: string) => {
		const newColorset: colorset = {
			id: `view_${utils.getUUID()}`,
			fieldValue: "",
			color: "#000000"
		}
		const datasets = getDataSets()
		const datasetIndex = datasets.findIndex(
			(dataset: any) => dataset.id === datasetId
		)
		if (datasetIndex === -1) return
		const targetDataset = datasets[datasetIndex]
		targetDataset.colorsets = targetDataset.colorsets
			? [...targetDataset.colorsets, newColorset]
			: [newColorset]
		updateDataset(datasetId, { colorsets: targetDataset.colorsets })
	}

	const removeColorset = (datasetId: string, colorsetId: string) => {
		const datasets = getDataSets()
		const datasetIndex = datasets.findIndex(
			(dataset: any) => dataset.id === datasetId
		)
		if (datasetIndex === -1) return
		const targetDataset = datasets[datasetIndex]
		const updatedColorsets = (targetDataset.colorsets || []).filter(
			(colorItem: any) => colorItem.id !== colorsetId
		)
		updateDataset(datasetId, { colorsets: updatedColorsets })
	}

	const updateColorset = (
		datasetId: string,
		colorsetId: string,
		newColorsetData: Partial<colorset>
	) => {
		const datasets = getDataSets()
		const datasetIndex = datasets.findIndex(
			(dataset: any) => dataset.id === datasetId
		)
		if (datasetIndex === -1) return
		const targetDataset = datasets[datasetIndex]
		const updatedColorsets = (targetDataset.colorsets || []).map(
			(colorItem: any) =>
				colorItem.id === colorsetId
					? { ...colorItem, ...newColorsetData }
					: colorItem
		)
		updateDataset(datasetId, { colorsets: updatedColorsets })
	}

	return (
		<div className="view-layers-toggle-setting">
			<SettingSection>
				<SettingRow
					flow={"wrap"}
					level={2}
					label={"Max Events Before Squishing"}
				>
					<NumericInput
						value={config.maxEventCount}
						onChange={(value) => {
							props.onSettingChange({
								id,
								config: { ...config, maxEventCount: value }
							})
						}}
						title="Max Event Count"
						placeholder="Max Event Count"
					/>
				</SettingRow>
			</SettingSection>
			<SettingSection>
				<SettingRow
					flow={"no-wrap"}
					level={1}
					tag={"div"}
					label={props.intl.formatMessage({
						id: "dataSources",
						defaultMessage: "Add Data Sources"
					})}
				>
					<Button type="secondary" onClick={addDataset}>
						{props.intl.formatMessage({
							id: "Add Dataset",
							defaultMessage: "Add Dataset"
						})}
					</Button>
				</SettingRow>
			</SettingSection>

			{config?.dataSets && config.dataSets.length > 0 && (
				<SettingSection title={props.intl.formatMessage({ id: "Datasets" })}>
					<Tabs
						value={activeTab}
						onChange={(tabId) => {
							setActiveTab(tabId)
						}}
						type="tabs"
						keepMount
						scrollable={true}
						onClose={(tabId) => {
							removeDataset(tabId)
						}}
						children={
							config.dataSets.map(
								(dataset: ImmutableObject<data>, datasetIndex: number) => {
									// Key change!
									const datasetUseDataSources = dataset.dataSourceId
										? Immutable(
												(props.useDataSources || []).filter(
													(widgetDataSource) =>
														widgetDataSource.dataSourceId ===
														dataset.dataSourceId
												)
											)
										: Immutable([])

									return (
										<Tab
											id={dataset.id}
											key={dataset.id}
											title={`Dataset ${datasetIndex + 1}`}
											closeable
										>
											<SettingRow label={"Data Source"} level={1} flow={"wrap"}>
												<DataSourceSelector
													types={Immutable([DataSourceTypes.FeatureLayer])}
													mustUseDataSource={true}
													isMultiple={false}
													useDataSources={datasetUseDataSources}
													useDataSourcesEnabled={props.useDataSourcesEnabled}
													onChange={(selectedDataSources: UseDataSource[]) => {
														handleDataSourceChange(
															dataset.asMutable({ deep: true }),
															selectedDataSources
														)
													}}
													widgetId={props.id}
												/>
											</SettingRow>
											{dataset.dataSourceId && (
												<>
													<SettingRow
														label={"Select Label Field"}
														level={2}
														flow={"wrap"}
														tag={"label"}
													>
														<FieldSelector
															useDataSources={datasetUseDataSources}
															useDropdown={true}
															isMultiple={false}
															isDataSourceDropDownHidden={true}
															onChange={(fields) => {
																updateDataset(dataset.id, {
																	labelField: fields?.[0]?.jimuName ?? null
																})
															}}
															selectedFields={
																dataset?.labelField
																	? Immutable([dataset.labelField])
																	: datasetUseDataSources?.[0]?.fields
															}
														/>
													</SettingRow>

													<SettingRow
														label={"Start Date Field"}
														level={1}
														flow={"wrap"}
														tag={"label"}
													>
														<FieldSelector
															useDataSources={datasetUseDataSources}
															useDropdown={true}
															isMultiple={false}
															isDataSourceDropDownHidden={true}
															onChange={(fields) => {
																updateDataset(dataset.id, {
																	startDateField: fields?.[0]?.jimuName ?? null
																})
															}}
															selectedFields={
																dataset?.startDateField
																	? Immutable([dataset.startDateField])
																	: datasetUseDataSources?.[0]?.fields
															}
														/>
													</SettingRow>

													<SettingRow
														label={"End Date Field"}
														level={2}
														flow={"wrap"}
														tag={"label"}
													>
														<FieldSelector
															useDataSources={datasetUseDataSources}
															useDropdown={true}
															isMultiple={false}
															isDataSourceDropDownHidden={true}
															onChange={(fields) => {
																updateDataset(dataset.id, {
																	endDateField: fields?.[0]?.jimuName ?? null
																})
															}}
															selectedFields={
																dataset?.endDateField
																	? Immutable([dataset.endDateField])
																	: datasetUseDataSources?.[0]?.fields
															}
														/>
													</SettingRow>

													<SettingRow
														label={"All Day Field"}
														level={2}
														flow={"wrap"}
														tag={"label"}
													>
														<FieldSelector
															useDataSources={datasetUseDataSources}
															useDropdown={true}
															isMultiple={false}
															isDataSourceDropDownHidden={true}
															onChange={(fields) => {
																updateDataset(dataset.id, {
																	allDayField: fields?.[0]?.jimuName ?? null
																})
															}}
															selectedFields={
																dataset?.allDayField
																	? Immutable([dataset.allDayField])
																	: datasetUseDataSources?.[0]?.fields
															}
														/>
													</SettingRow>

													<SettingRow
														label={"Description Field"}
														level={2}
														flow={"wrap"}
														tag={"label"}
													>
														<FieldSelector
															useDataSources={datasetUseDataSources}
															useDropdown={true}
															isMultiple={false}
															isDataSourceDropDownHidden={true}
															onChange={(fields) => {
																updateDataset(dataset.id, {
																	descriptionField:
																		fields?.[0]?.jimuName ?? null
																})
															}}
															selectedFields={
																dataset?.descriptionField
																	? Immutable([dataset.descriptionField])
																	: datasetUseDataSources?.[0]?.fields
															}
														/>
													</SettingRow>
													{dataset.labelField &&
														dataset.startDateField &&
														dataset.endDateField && (
															<>
																<CollapsablePanel
																	label={"Color Settings"}
																	defaultIsOpen={true}
																>
																	<SettingRow
																		label={"Default Event Color"}
																		level={1}
																		flow={"no-wrap"}
																		tag={"label"}
																	>
																		<input
																			type="color"
																			value={
																				dataset?.defaultEventColor || "#3788d8"
																			}
																			onChange={(changeEvent) => {
																				updateDataset(dataset.id, {
																					defaultEventColor:
																						changeEvent.target.value
																				})
																			}}
																		/>
																	</SettingRow>
																	<SettingRow
																		label={"Color Field"}
																		level={2}
																		flow={"wrap"}
																		tag={"label"}
																	>
																		<FieldSelector
																			useDataSources={datasetUseDataSources}
																			useDropdown={true}
																			isMultiple={false}
																			isDataSourceDropDownHidden={true}
																			onChange={(fields) => {
																				updateDataset(dataset.id, {
																					colorsetField:
																						fields?.[0]?.jimuName ?? null
																				})
																			}}
																			selectedFields={
																				dataset?.colorsetField
																					? Immutable([dataset.colorsetField])
																					: datasetUseDataSources?.[0]?.fields
																			}
																		/>
																	</SettingRow>
																	{dataset.colorsetField && (
																		<SettingRow
																			label={"Map field values to colors"}
																			level={2}
																			flow={"wrap"}
																			tag={"div"}
																		>
																			{(dataset.colorsets || []).map(
																				(
																					colorEntry: any,
																					colorIndex: number
																				) => (
																					<div
																						key={colorEntry.id}
																						className="value-config-container"
																						style={{ paddingBottom: "8px" }}
																					>
																						<SettingRow
																							label={`${props.intl.formatMessage(
																								{
																									id: "Color"
																								}
																							)} ${colorIndex + 1}`}
																							flow="no-wrap"
																							level={2}
																						>
																							<Button
																								size="sm"
																								type="tertiary"
																								onClick={() => {
																									removeColorset(
																										dataset.id,
																										colorEntry.id
																									)
																								}}
																							>
																								Remove
																							</Button>
																						</SettingRow>
																						<SettingRow
																							flow="wrap"
																							label={props.intl.formatMessage({
																								id: "Value to Color"
																							})}
																							level={3}
																							css={css`
																								margin-top: 4px !important;
																							`}
																						>
																							<TextInput
																								size="sm"
																								value={colorEntry.fieldValue}
																								onChange={(changeEvent) => {
																									updateColorset(
																										dataset.id,
																										colorEntry.id,
																										{
																											fieldValue:
																												changeEvent
																													.currentTarget.value
																										}
																									)
																								}}
																							/>
																							<input
																								type="color"
																								value={
																									colorEntry.color || "#3788d8"
																								}
																								onChange={(changeEvent) => {
																									updateColorset(
																										dataset.id,
																										colorEntry.id,
																										{
																											color:
																												changeEvent
																													.currentTarget.value
																										}
																									)
																								}}
																							/>
																						</SettingRow>
																					</div>
																				)
																			)}
																			<Button
																				type="primary"
																				className="w-100 mt-2"
																				onClick={() => {
																					addColorset(dataset.id)
																				}}
																			>
																				{props.intl.formatMessage({
																					id: "Add Color"
																				})}
																			</Button>
																		</SettingRow>
																	)}
																</CollapsablePanel>
															</>
														)}
												</>
											)}
										</Tab>
									)
								}
							) as any
						}
					/>
				</SettingSection>
			)}
		</div>
	)
}
