import {
	React,
	Immutable,
	type UseDataSource,
	DataSourceTypes,
	utils,
	type ImmutableObject
} from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import { SettingRow, SettingSection } from "jimu-ui/advanced/setting-components"
import { Button, TextInput, Tabs, Tab, CollapsablePanel } from "jimu-ui"
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
		const arr = getDataSets()
		const idx = arr.findIndex((d: any) => d.id === datasetId)
		if (idx === -1) return
		arr[idx] = { ...arr[idx], ...newData }
		const newConfig = (config || Immutable({})).set("dataSets", arr)
		props.onSettingChange({ id, config: newConfig })
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
			colorsets: [] as colorset[],
			useDataSources: [] as UseDataSource[]
		}
		const arr = getDataSets()
		arr.push(newDataset)
		const newConfig = (config || Immutable({})).set("dataSets", arr)
		props.onSettingChange({ id, config: newConfig })
	}

	const removeDataset = (datasetId: string) => {
		const arr = getDataSets().filter((d: any) => d.id !== datasetId)
		const newConfig = (config || Immutable({})).set("dataSets", arr)
		props.onSettingChange({ id, config: newConfig })
	}

	const addValue = (datasetId: string) => {
		const newValue: colorset = {
			id: `view_${utils.getUUID()}`,
			fieldValue: ``,
			color: `#000000`
		}
		const arr = getDataSets()
		const idx = arr.findIndex((d: any) => d.id === datasetId)
		if (idx === -1) return
		const ds = arr[idx]
		ds.colorsets = ds.colorsets ? [...ds.colorsets, newValue] : [newValue]
		updateDataset(datasetId, { colorsets: ds.colorsets })
	}

	const removeValue = (datasetId: string, viewId: string) => {
		const arr = getDataSets()
		const idx = arr.findIndex((d: any) => d.id === datasetId)
		if (idx === -1) return
		const ds = arr[idx]
		const newcolorsets = (ds.colorsets || []).filter(
			(v: any) => v.id !== viewId
		)
		updateDataset(datasetId, { colorsets: newcolorsets })
	}

	const updateValue = (
		datasetId: string,
		viewId: string,
		newViewData: Partial<colorset>
	) => {
		const arr = getDataSets()
		const idx = arr.findIndex((d: any) => d.id === datasetId)
		if (idx === -1) return
		const ds = arr[idx]
		const newcolorsets = (ds.colorsets || []).map((v: any) =>
			v.id === viewId ? { ...v, ...newViewData } : v
		)
		updateDataset(datasetId, { colorsets: newcolorsets })
	}

	return (
		<div className="view-layers-toggle-setting">
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
						onChange={(id) => {
							setActiveTab(id)
						}}
						type="tabs"
						keepMount
						onClose={(id) => {
							removeDataset(id)
						}}
						children={
							config.dataSets.map(
								(ds: ImmutableObject<data>, dsIndex: number) => (
									<Tab
										id={ds.id}
										key={ds.id}
										title={`Dataset ${dsIndex + 1}`}
										closeable
									>
										<SettingRow label={"Data Source"} level={1} flow={"wrap"}>
											<DataSourceSelector
												types={Immutable([DataSourceTypes.FeatureLayer])}
												mustUseDataSource={true}
												isMultiple={true}
												useDataSources={ds.useDataSources}
												useDataSourcesEnabled={props.useDataSourcesEnabled}
												onChange={(uds: UseDataSource[]) => {
													updateDataset(ds.id, { useDataSources: uds })
												}}
												widgetId={props.id}
											/>
										</SettingRow>
										{ds.useDataSources?.length === 1 && (
											<>
												<SettingRow
													label={"Select Label Field"}
													level={2}
													flow={"wrap"}
													tag={"label"}
												>
													<FieldSelector
														useDataSources={ds.useDataSources}
														useDropdown={true}
														isMultiple={false}
														isDataSourceDropDownHidden={true}
														onChange={(fields) => {
															updateDataset(ds.id, {
																labelField: fields?.[0]?.jimuName ?? null
															})
														}}
														selectedFields={
															ds?.labelField
																? Immutable([ds.labelField])
																: ds?.useDataSources?.[0]?.fields
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
														useDataSources={ds.useDataSources}
														useDropdown={true}
														isMultiple={false}
														isDataSourceDropDownHidden={true}
														onChange={(fields) => {
															updateDataset(ds.id, {
																startDateField: fields?.[0]?.jimuName ?? null
															})
														}}
														selectedFields={
															ds?.startDateField
																? Immutable([ds.startDateField])
																: ds?.useDataSources?.[0]?.fields
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
														useDataSources={ds.useDataSources}
														useDropdown={true}
														isMultiple={false}
														isDataSourceDropDownHidden={true}
														onChange={(fields) => {
															updateDataset(ds.id, {
																endDateField: fields?.[0]?.jimuName ?? null
															})
														}}
														selectedFields={
															ds?.endDateField
																? Immutable([ds.endDateField])
																: ds?.useDataSources?.[0]?.fields
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
														useDataSources={ds.useDataSources}
														useDropdown={true}
														isMultiple={false}
														isDataSourceDropDownHidden={true}
														onChange={(fields) => {
															updateDataset(ds.id, {
																allDayField: fields?.[0]?.jimuName ?? null
															})
														}}
														selectedFields={
															ds?.allDayField
																? Immutable([ds.allDayField])
																: ds?.useDataSources?.[0]?.fields
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
														useDataSources={ds.useDataSources}
														useDropdown={true}
														isMultiple={false}
														isDataSourceDropDownHidden={true}
														onChange={(fields) => {
															updateDataset(ds.id, {
																descriptionField: fields?.[0]?.jimuName ?? null
															})
														}}
														selectedFields={
															ds?.descriptionField
																? Immutable([ds.descriptionField])
																: ds?.useDataSources?.[0]?.fields
														}
													/>
												</SettingRow>
												{ds.labelField &&
													ds.startDateField &&
													ds.endDateField && (
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
																		value={ds?.defaultEventColor || "#3788d8"}
																		onChange={(e) => {
																			updateDataset(ds.id, {
																				defaultEventColor: e.target.value
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
																		useDataSources={ds.useDataSources}
																		useDropdown={true}
																		isMultiple={false}
																		isDataSourceDropDownHidden={true}
																		onChange={(fields) => {
																			updateDataset(ds.id, {
																				colorsetField:
																					fields?.[0]?.jimuName ?? null
																			})
																		}}
																		selectedFields={
																			ds?.colorsetField
																				? Immutable([ds.colorsetField])
																				: ds?.useDataSources?.[0]?.fields
																		}
																	/>
																</SettingRow>
																{ds.colorsetField && (
																	<SettingRow
																		label={"Map field values to colors"}
																		level={2}
																		flow={"wrap"}
																		tag={"div"}
																	>
																		{(ds.colorsets || []).map(
																			(value: any, index: number) => (
																				<div
																					key={value.id}
																					className="value-config-container"
																				>
																					<SettingRow
																						label={`${props.intl.formatMessage({
																							id: "Color"
																						})} ${index + 1}`}
																						flow="no-wrap"
																						level={3}
																					>
																						<Button
																							size="sm"
																							type="tertiary"
																							onClick={() => {
																								removeValue(ds.id, value.id)
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
																						level={1}
																					>
																						<TextInput
																							size="sm"
																							value={value.fieldValue}
																							onChange={(e) => {
																								updateValue(ds.id, value.id, {
																									fieldValue:
																										e.currentTarget.value
																								})
																							}}
																						/>
																						<input
																							type="color"
																							value={value.color || "#3788d8"}
																							onChange={(e) => {
																								updateValue(ds.id, value.id, {
																									color: e.currentTarget.value
																								})
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
																				addValue(ds.id)
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
							) as any
						}
					/>
				</SettingSection>
			)}
		</div>
	)
}
