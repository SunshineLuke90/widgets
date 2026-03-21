import {
	React,
	Immutable,
	type UseDataSource,
	DataSourceTypes,
	DataSourceManager,
	type IMFieldSchema,
	type IMSqlExpression,
	type JimuFieldType
} from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import { SettingRow, SettingSection } from "jimu-ui/advanced/setting-components"
import type { IMConfig } from "../config"
import {
	DataSourceSelector,
	FieldSelector
} from "jimu-ui/advanced/data-source-selector"
import { IconPicker } from "jimu-ui/advanced/resource-selector"
import { SqlExpressionBuilderPopup } from "jimu-ui/advanced/sql-expression-builder"
import {
	Button,
	ButtonGroup,
	Select,
	CollapsablePanel,
	Tabs,
	Tab,
	Switch
} from "jimu-ui"
import TextStyleSetting from "./text-style-setting"
import NumberFormatSetting from "./number-format-setting"

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
	const { id, config, onSettingChange } = props
	const [expressionvisibility, setExpressionVisibility] = React.useState(false)
	const [refExpressionVisibility, setRefExpressionVisibility] =
		React.useState(false)

	const onFieldsChange = (fields: IMFieldSchema[]) => {
		const fieldNames = fields?.map((f) => f.jimuName)
		const primary = {
			...props.useDataSources[0].asMutable({ deep: true }),
			fields: fieldNames
		}
		const ref = props.useDataSources?.[1]?.asMutable({ deep: true })
		onSettingChange({
			id: id,
			useDataSources: ref ? [primary, ref] : [primary]
		})
	}

	const onRefFieldsChange = (fields: IMFieldSchema[]) => {
		const fieldNames = fields?.map((f) => f.jimuName)
		const primary = props.useDataSources[0].asMutable({ deep: true })
		const ref = {
			...props.useDataSources[1].asMutable({ deep: true }),
			fields: fieldNames
		}
		onSettingChange({
			id: id,
			useDataSources: [primary, ref]
		})
	}

	const onDataSourceChange = (useDataSources: UseDataSource[]) => {
		const primary = useDataSources[0]
		// Auto-populate the reference data source from the primary
		const ref = (props.useDataSources?.[1] ?? primary) as any
		const refMutable = ref?.asMutable ? ref.asMutable({ deep: true }) : ref
		onSettingChange({
			id: id,
			useDataSources: primary ? [primary, refMutable] : []
		})
	}

	const onRefDataSourceChange = (refDataSources: UseDataSource[]) => {
		const ref = refDataSources[0]
		const primaryMutable = props.useDataSources[0].asMutable({ deep: true })
		onSettingChange({
			id: id,
			useDataSources: [primaryMutable, ...(ref ? [ref] : [])]
		})
	}

	const onIconChange = (icon) => {
		onSettingChange({
			id: id,
			config: {
				...config,
				icon: icon
			}
		})
	}

	return (
		<div className="view-layers-toggle-setting">
			<Tabs
				className="w-100"
				scrollable
				type="underline"
				keepMount={true}
				defaultValue="data-tab"
				fill
			>
				<Tab title="Data" key="data" id={"data-tab"}>
					<SettingSection>
						<CollapsablePanel
							label={props.intl.formatMessage({
								id: "settingsCollapse",
								defaultMessage: "Settings"
							})}
							style={{ margin: "4px 4px 0 4px" }}
							defaultIsOpen={true}
						>
							<SettingRow>
								<DataSourceSelector
									types={Immutable([DataSourceTypes.FeatureLayer])}
									mustUseDataSource={true}
									useDataSources={
										props.useDataSources?.[0]
											? Immutable([props.useDataSources[0]])
											: Immutable([])
									}
									useDataSourcesEnabled={props.useDataSourcesEnabled}
									onChange={onDataSourceChange}
									widgetId={props.id}
								/>
							</SettingRow>
							{props.useDataSources?.[0] && (
								<>
									<SettingRow
										label={props.intl.formatMessage({
											id: "selectDataSource",
											defaultMessage: "Filter"
										})}
									>
										<Button
											onClick={() => {
												setExpressionVisibility(true)
											}}
											children={props.intl.formatMessage({
												id: "editExpression",
												defaultMessage: "+ Filter"
											})}
										/>
										<SqlExpressionBuilderPopup
											expression={config.indQuery}
											dataSource={
												props.useDataSources?.[0]
													? DataSourceManager.getInstance().getDataSource(
															props.useDataSources[0].dataSourceId
														)
													: null
											}
											onChange={(expression: IMSqlExpression) => {
												onSettingChange({
													id: id,
													config: {
														...config,
														indQuery: expression
													}
												})
												setExpressionVisibility(false)
											}}
											isOpen={expressionvisibility}
											toggle={() => {
												setExpressionVisibility(!expressionvisibility)
											}}
										/>
									</SettingRow>
									<SettingRow
										label={props.intl.formatMessage({
											id: "indValueType",
											defaultMessage: "Value Type"
										})}
										flow={"wrap"}
									>
										<ButtonGroup>
											<Button
												active={config?.indType === "Statistic"}
												onClick={() => {
													onSettingChange({
														id: id,
														config: {
															...config,
															indType: "Statistic"
														}
													})
												}}
												children={props.intl.formatMessage({
													id: "editExpression",
													defaultMessage: "Statistic"
												})}
											/>
											<Button
												active={config?.indType === "Feature"}
												onClick={() => {
													onSettingChange({
														id: id,
														config: {
															...config,
															indType: "Feature"
														}
													})
												}}
												children={props.intl.formatMessage({
													id: "selectField",
													defaultMessage: "Feature"
												})}
											/>
										</ButtonGroup>
									</SettingRow>
									{config.indType === "Statistic" && (
										<SettingRow
											label={props.intl.formatMessage({
												id: "indStatisticType",
												defaultMessage: "Statistic"
											})}
											flow={"wrap"}
										>
											<Select
												id="mainStatisticType"
												size="sm"
												value={config.mainStatisticType}
												onChange={(e) => {
													onSettingChange({
														id: id,
														config: {
															...config,
															mainStatisticType: e.target.value as
																| "count"
																| "sum"
																| "avg"
																| "min"
																| "max"
														}
													})
												}}
											>
												<option
													value="count"
													children={props.intl.formatMessage({
														id: "count",
														defaultMessage: "Count"
													})}
												/>
												<option
													value="avg"
													children={props.intl.formatMessage({
														id: "avg",
														defaultMessage: "Average"
													})}
												/>
												<option
													value="min"
													children={props.intl.formatMessage({
														id: "min",
														defaultMessage: "Min"
													})}
												/>
												<option
													value="max"
													children={props.intl.formatMessage({
														id: "max",
														defaultMessage: "Max"
													})}
												/>
												<option
													value="sum"
													children={props.intl.formatMessage({
														id: "sum",
														defaultMessage: "Sum"
													})}
												/>
											</Select>
										</SettingRow>
									)}
									<SettingRow
										label={
											config.indType === "Statistic"
												? props.intl.formatMessage({
														id: "selectField",
														defaultMessage: "Field"
													})
												: props.intl.formatMessage({
														id: "selectValueField",
														defaultMessage: "Value Field"
													})
										}
										flow={"wrap"}
									>
										<FieldSelector
											useDataSources={
												props.useDataSources?.[0]
													? Immutable([props.useDataSources[0]])
													: Immutable([])
											}
											useDropdown={true}
											isMultiple={false}
											isDataSourceDropDownHidden={true}
											onChange={onFieldsChange}
											selectedFields={props.useDataSources?.[0]?.fields}
											types={
												config.mainStatisticType === "count"
													? undefined
													: Immutable([
															"NUMBER" as JimuFieldType,
															"DATE" as JimuFieldType,
															"DATE_ONLY" as JimuFieldType,
															"TIME_ONLY" as JimuFieldType
														])
											}
										/>
									</SettingRow>
								</>
							)}
						</CollapsablePanel>
					</SettingSection>
					<SettingSection>
						<CollapsablePanel
							label={props.intl.formatMessage({
								id: "referenceCollapse",
								defaultMessage: "Reference"
							})}
							style={{ margin: "4px 4px 0 4px" }}
							defaultIsOpen={false}
						>
							<SettingRow
								label={props.intl.formatMessage({
									id: "refType",
									defaultMessage: "Reference Type"
								})}
								flow={"wrap"}
							>
								<Select
									id="refType"
									size="sm"
									defaultValue={"none"}
									value={config.refType}
									onChange={(e) => {
										onSettingChange({
											id: id,
											config: {
												...config,
												refType: e.target.value
											}
										})
									}}
								>
									<option
										value="none"
										children={props.intl.formatMessage({
											id: "none",
											defaultMessage: "None"
										})}
									/>
									<option
										value="Statistic"
										children={props.intl.formatMessage({
											id: "statistic",
											defaultMessage: "Statistic"
										})}
									/>
									<option
										value="Feature"
										children={props.intl.formatMessage({
											id: "feature",
											defaultMessage: "Feature"
										})}
									/>
									<option
										value="FixedValue"
										children={props.intl.formatMessage({
											id: "fixedValue",
											defaultMessage: "Fixed Value"
										})}
									/>
									<option
										value="PreviousValue"
										children={props.intl.formatMessage({
											id: "previousValue",
											defaultMessage: "Previous Value"
										})}
									/>
								</Select>
							</SettingRow>
							{config.refType === "Statistic" && (
								<>
									<SettingRow>
										<DataSourceSelector
											types={Immutable([DataSourceTypes.FeatureLayer])}
											mustUseDataSource={true}
											useDataSources={
												props.useDataSources?.[1]
													? Immutable([props.useDataSources[1]])
													: Immutable([])
											}
											useDataSourcesEnabled={props.useDataSourcesEnabled}
											onChange={onRefDataSourceChange}
											widgetId={props.id}
										/>
									</SettingRow>
									<SettingRow
										label={props.intl.formatMessage({
											id: "selectDataSourceReference",
											defaultMessage: "Filter"
										})}
									>
										<Button
											onClick={() => {
												setRefExpressionVisibility(true)
											}}
											children={props.intl.formatMessage({
												id: "editReferenceExpression",
												defaultMessage: "+ Filter"
											})}
										/>
										<SqlExpressionBuilderPopup
											expression={config.refQuery}
											dataSource={
												props.useDataSources?.[1]
													? DataSourceManager.getInstance().getDataSource(
															props.useDataSources[1].dataSourceId
														)
													: null
											}
											onChange={(expression: IMSqlExpression) => {
												onSettingChange({
													id: id,
													config: {
														...config,
														refQuery: expression
													}
												})
												setRefExpressionVisibility(false)
											}}
											isOpen={refExpressionVisibility}
											toggle={() => {
												setRefExpressionVisibility(!refExpressionVisibility)
											}}
										/>
									</SettingRow>
									<SettingRow
										label={props.intl.formatMessage({
											id: "refStatisticTypeRow",
											defaultMessage: "Statistic"
										})}
										flow={"wrap"}
									>
										<Select
											id="refStatisticType"
											size="sm"
											value={config.refStatisticType}
											onChange={(e) => {
												onSettingChange({
													id: id,
													config: {
														...config,
														refStatisticType: e.target.value as
															| "count"
															| "sum"
															| "avg"
															| "min"
															| "max"
													}
												})
											}}
										>
											<option
												value="count"
												children={props.intl.formatMessage({
													id: "count",
													defaultMessage: "Count"
												})}
											/>
											<option
												value="avg"
												children={props.intl.formatMessage({
													id: "avg",
													defaultMessage: "Average"
												})}
											/>
											<option
												value="min"
												children={props.intl.formatMessage({
													id: "min",
													defaultMessage: "Min"
												})}
											/>
											<option
												value="max"
												children={props.intl.formatMessage({
													id: "max",
													defaultMessage: "Max"
												})}
											/>
											<option
												value="sum"
												children={props.intl.formatMessage({
													id: "sum",
													defaultMessage: "Sum"
												})}
											/>
										</Select>
									</SettingRow>
									<SettingRow
										label={props.intl.formatMessage({
											id: "selectField",
											defaultMessage: "Field"
										})}
										flow={"wrap"}
									>
										<FieldSelector
											useDataSources={
												props.useDataSources?.[1]
													? Immutable([props.useDataSources[1]])
													: Immutable([])
											}
											useDropdown={true}
											isMultiple={false}
											isDataSourceDropDownHidden={true}
											onChange={onRefFieldsChange}
											selectedFields={props.useDataSources?.[1]?.fields}
											types={
												config.refStatisticType === "count"
													? undefined
													: Immutable([
															"NUMBER" as JimuFieldType,
															"DATE" as JimuFieldType,
															"DATE_ONLY" as JimuFieldType,
															"TIME_ONLY" as JimuFieldType
														])
											}
										/>
									</SettingRow>
								</>
							)}
						</CollapsablePanel>
					</SettingSection>
				</Tab>
				<Tab title="Indicator" key="indicator" id={"indicator-tab"}>
					<SettingSection
						title={props.intl.formatMessage({
							id: "indicatorSettings",
							defaultMessage: "Settings"
						})}
					>
						<TextStyleSetting
							prefix="top"
							label={props.intl.formatMessage({
								id: "topText",
								defaultMessage: "Top Text"
							})}
							config={config}
							intl={props.intl}
							onChange={(patch) => {
								onSettingChange({ id, config: { ...config, ...patch } })
							}}
						/>
						<TextStyleSetting
							prefix="middle"
							label={props.intl.formatMessage({
								id: "middleText",
								defaultMessage: "Middle Text"
							})}
							config={config}
							intl={props.intl}
							onChange={(patch) => {
								onSettingChange({ id, config: { ...config, ...patch } })
							}}
						/>
						<TextStyleSetting
							prefix="bottom"
							label={props.intl.formatMessage({
								id: "bottomText",
								defaultMessage: "Bottom Text"
							})}
							config={config}
							intl={props.intl}
							onChange={(patch) => {
								onSettingChange({ id, config: { ...config, ...patch } })
							}}
						/>
						<SettingRow
							label={props.intl.formatMessage({
								id: "iconSelector",
								defaultMessage: "Select Icon"
							})}
							flow={"no-wrap"}
						>
							<IconPicker icon={config?.icon as any} onChange={onIconChange} />
						</SettingRow>
						{config.icon && (
							<SettingRow
								label={props.intl.formatMessage({
									id: "iconPosition",
									defaultMessage: "Icon Position"
								})}
								flow={"no-wrap"}
							>
								<ButtonGroup>
									<Button
										value="left"
										active={config.iconPosition === "left"}
										onClick={() => {
											onSettingChange({
												id,
												config: { ...config, iconPosition: "left" }
											})
										}}
										children={props.intl.formatMessage({
											id: "left",
											defaultMessage: "Left"
										})}
									/>
									<Button
										value="right"
										active={config.iconPosition === "right"}
										onClick={() => {
											onSettingChange({
												id,
												config: { ...config, iconPosition: "right" }
											})
										}}
										children={props.intl.formatMessage({
											id: "right",
											defaultMessage: "Right"
										})}
									/>
								</ButtonGroup>
							</SettingRow>
						)}
					</SettingSection>
					<SettingSection>
						<CollapsablePanel
							label={props.intl.formatMessage({
								id: "valueFormatting",
								defaultMessage: "Value Formatting"
							})}
							style={{ margin: "4px 4px 0 4px" }}
							defaultIsOpen={false}
						>
							<SettingRow
								label={props.intl.formatMessage({
									id: "styleText",
									defaultMessage: "Style"
								})}
								flow="wrap"
							>
								<ButtonGroup>
									<Button
										value="Decimal"
										active={config.valueStyle === "Decimal"}
										onClick={() => {
											onSettingChange({
												id,
												config: { ...config, valueStyle: "Decimal" }
											})
										}}
										children="Decimal"
									/>
									<Button
										value="Percentage"
										active={config.valueStyle === "Percentage"}
										onClick={() => {
											onSettingChange({
												id,
												config: { ...config, valueStyle: "Percentage" }
											})
										}}
										children="Percentage"
									/>
								</ButtonGroup>
							</SettingRow>
							<NumberFormatSetting
								prefix="value"
								config={config}
								intl={props.intl}
								onChange={(patch) => {
									onSettingChange({ id, config: { ...config, ...patch } })
								}}
							/>
							<SettingRow
								label={props.intl.formatMessage({
									id: "unitPrefix",
									defaultMessage: "Unit prefix"
								})}
							>
								<Switch
									checked={config.valueUnitPrefix}
									onChange={() => {
										onSettingChange({
											id,
											config: {
												...config,
												valueUnitPrefix: !config.valueUnitPrefix
											}
										})
									}}
								/>
							</SettingRow>
						</CollapsablePanel>
					</SettingSection>
					<SettingSection>
						<CollapsablePanel
							label={props.intl.formatMessage({
								id: "percentageFormatting",
								defaultMessage: "Percentage Formatting"
							})}
							style={{ margin: "4px 4px 0 4px" }}
							defaultIsOpen={false}
						>
							<NumberFormatSetting
								prefix="pct"
								config={config}
								intl={props.intl}
								onChange={(patch) => {
									onSettingChange({ id, config: { ...config, ...patch } })
								}}
							/>
						</CollapsablePanel>
					</SettingSection>
					<SettingSection>
						<CollapsablePanel
							label={props.intl.formatMessage({
								id: "ratioFormatting",
								defaultMessage: "Ratio Formatting"
							})}
							style={{ margin: "4px 4px 0 4px" }}
							defaultIsOpen={false}
						>
							<NumberFormatSetting
								prefix="ratio"
								config={config}
								intl={props.intl}
								onChange={(patch) => {
									onSettingChange({ id, config: { ...config, ...patch } })
								}}
							/>
						</CollapsablePanel>
					</SettingSection>
				</Tab>
			</Tabs>
		</div>
	)
}
