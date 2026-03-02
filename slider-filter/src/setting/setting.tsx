import {
	React,
	Immutable,
	type UseDataSource,
	DataSourceTypes,
	type IMFieldSchema,
	DataSourceComponent,
	type QueriableDataSource,
	type StatisticType,
	type JimuFieldType
} from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import {
	SettingRow,
	SettingSection,
	RadioGroup
} from "jimu-ui/advanced/setting-components"
import type { IMConfig } from "../config"
import {
	DataSourceSelector,
	FieldSelector
} from "jimu-ui/advanced/data-source-selector"
import { NumericInput, Select, Switch, TextInput } from "jimu-ui"
import { DatePicker } from "jimu-ui/basic/date-picker"
import { ColorPicker } from "jimu-ui/basic/color-picker"

async function getFieldMinMax(
	dataSource: QueriableDataSource,
	fieldName: string
): Promise<{ min: number; max: number } | null> {
	if (!dataSource) return null

	const outStatistics = [
		{
			statisticType: "min" as StatisticType,
			onStatisticField: fieldName,
			outStatisticFieldName: "minValue"
		},
		{
			statisticType: "max" as StatisticType,
			onStatisticField: fieldName,
			outStatisticFieldName: "maxValue"
		}
	]

	const result = await dataSource.query({ outStatistics } as any)
	const stats = result?.records?.[0]?.getData()
	return stats ? { min: stats.minValue, max: stats.maxValue } : null
}

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
	const { id, config, onSettingChange } = props
	const [dataSource, setDataSource] = React.useState<QueriableDataSource>(null)
	const selectedField = props.useDataSources?.[0]?.fields?.[0]

	// When the data source and field are both available, query for min/max
	React.useEffect(() => {
		if (!dataSource || !selectedField) return

		getFieldMinMax(dataSource, selectedField).then((minMax) => {
			if (minMax) {
				props.onSettingChange({
					id: props.id,
					config: {
						...props.config,
						minValue: minMax.min,
						maxValue: minMax.max
					}
				})
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dataSource, selectedField])

	const onFieldsChange = (fields: IMFieldSchema[]) => {
		const useDataSource = props.useDataSources[0]
			.set(
				"fields",
				fields?.map((f) => f.jimuName)
			)
			.asMutable({ deep: true })
		props.onSettingChange({
			id: props.id,
			useDataSources: [useDataSource],
			config: { ...config, rangeType: fields?.[0].type }
		})
	}

	const onDataSourceChange = (useDataSources: UseDataSource[]) => {
		props.onSettingChange({
			id: props.id,
			useDataSources: useDataSources
		})
	}

	return (
		<div className="view-layers-toggle-setting">
			<SettingSection title={"Data"}>
				<SettingRow label={"Data Source"} flow="wrap">
					<DataSourceSelector
						types={Immutable([DataSourceTypes.FeatureLayer])}
						mustUseDataSource={true}
						useDataSources={props.useDataSources}
						useDataSourcesEnabled={props.useDataSourcesEnabled}
						onChange={onDataSourceChange}
						widgetId={props.id}
					/>
				</SettingRow>
				<SettingRow label={"Filter Field"} flow="wrap">
					<FieldSelector
						useDataSources={props.useDataSources}
						useDropdown={true}
						isMultiple={false}
						types={Immutable([
							"NUMBER" as JimuFieldType,
							"DATE" as JimuFieldType,
							"DATE_ONLY" as JimuFieldType,
							"TIME_ONLY" as JimuFieldType
						])}
						isDataSourceDropDownHidden={true}
						onChange={onFieldsChange}
						selectedFields={props.useDataSources?.[0].fields}
					/>
				</SettingRow>
			</SettingSection>
			{config.rangeType && (
				<>
					<SettingSection>
						<SettingRow label={"Slider Range"} level={2} flow="wrap">
							{config.rangeType === "NUMBER" && (
								<>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											flex: 1
										}}
									>
										<label>Min Value</label>
										<NumericInput
											title="Min Value"
											placeholder="Min Value"
											value={config.minValue as number}
											onChange={(value) => {
												onSettingChange({
													id,
													config: { ...config, minValue: value }
												})
											}}
										></NumericInput>
									</div>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											flex: 1
										}}
									>
										<label>Max Value</label>
										<NumericInput
											title="Max Value"
											placeholder="Max Value"
											value={config.maxValue as number}
											onChange={(value) => {
												onSettingChange({
													id,
													config: { ...config, maxValue: value }
												})
											}}
										></NumericInput>
									</div>
								</>
							)}
							{(config.rangeType === "DATE" ||
								config.rangeType === "DATE_ONLY" ||
								config.rangeType === "TIME_ONLY") && (
								<>
									<DatePicker
										runtime={false}
										onChange={(date) => {
											onSettingChange({
												id,
												config: { ...config, minValue: date }
											})
										}}
										selectedDate={new Date(config.minValue as unknown as Date)}
									></DatePicker>
									<DatePicker
										runtime={false}
										onChange={(date) => {
											onSettingChange({
												id,
												config: { ...config, maxValue: date }
											})
										}}
										selectedDate={new Date(config.maxValue as unknown as Date)}
									></DatePicker>
								</>
							)}
						</SettingRow>
						<SettingRow flow="wrap">
							<Switch
								title="Show Ticks"
								checked={config.showTicks}
								onChange={(e) => {
									onSettingChange({
										id,
										config: { ...config, showTicks: e.target.checked }
									})
								}}
							></Switch>
							&nbsp;Show Ticks
						</SettingRow>
						{config.showTicks && (
							<SettingRow label={"Tick Settings"} level={2} flow="wrap">
								<div style={{ display: "flex", flexDirection: "row", flex: 1 }}>
									<NumericInput
										title="Interval"
										placeholder="Interval"
										value={config.tickInterval}
										onChange={(value) => {
											onSettingChange({
												id,
												config: { ...config, tickInterval: value }
											})
										}}
									></NumericInput>
									{(config.rangeType === "DATE" ||
										config.rangeType === "DATE_ONLY" ||
										config.rangeType === "TIME_ONLY") && (
										<Select
											title="Date Interval"
											placeholder="Date Interval"
											value={config.tickDateInterval}
											onChange={(e) => {
												onSettingChange({
													id,
													config: {
														...config,
														tickDateInterval: e.target.value
													}
												})
											}}
										>
											<option value="DAY">Days</option>
											<option value="MONTH">Months</option>
											<option value="YEAR">Years</option>
											<option value="HOUR">Hours</option>
											<option value="MINUTE">Minutes</option>
										</Select>
									)}
								</div>
							</SettingRow>
						)}
						<SettingRow level={3} flow="wrap">
							<Switch
								title="Show Current Values"
								checked={config.showCurrentValue}
								onChange={(e) => {
									onSettingChange({
										id,
										config: { ...config, showCurrentValue: e.target.checked }
									})
								}}
							></Switch>
							&nbsp;Show Current Values
						</SettingRow>
					</SettingSection>
					<SettingSection title={"Labels"}>
						<SettingRow label={"Min Label"} flow="wrap">
							<TextInput
								type="text"
								value={config.minLabel || ""}
								onChange={(e) => {
									onSettingChange({
										id,
										config: { ...config, minLabel: e.target.value }
									})
								}}
							/>
							<div style={{ marginTop: 8 }}>
								<RadioGroup
									options={[
										{ value: "TOP", content: "Top" },
										{ value: "BOTTOM", content: "Bottom" }
									]}
									value={config.minLabelPosition || "TOP"}
									onChange={(value) => {
										onSettingChange({
											id,
											config: {
												...config,
												minLabelPosition: value as "TOP" | "BOTTOM"
											}
										})
									}}
								/>
							</div>
						</SettingRow>
						<SettingRow label={"Max Label"} flow="wrap">
							<TextInput
								type="text"
								value={config.maxLabel || ""}
								onChange={(e) => {
									onSettingChange({
										id,
										config: { ...config, maxLabel: e.target.value }
									})
								}}
							/>
							<div style={{ marginTop: 8 }}>
								<RadioGroup
									options={[
										{ value: "TOP", content: "Top" },
										{ value: "BOTTOM", content: "Bottom" }
									]}
									value={config.maxLabelPosition || "TOP"}
									onChange={(value) => {
										onSettingChange({
											id,
											config: {
												...config,
												maxLabelPosition: value as "TOP" | "BOTTOM"
											}
										})
									}}
								/>
							</div>
						</SettingRow>
					</SettingSection>
					<SettingSection title={"Slider Color Theme"}>
						<SettingRow flow="no-wrap">
							<label style={{ marginRight: 8 }}>
								Start Color
								<ColorPicker
									color={config.startColor}
									onChange={(color) => {
										onSettingChange({
											id,
											config: { ...config, startColor: color }
										})
									}}
								></ColorPicker>
							</label>
							<label style={{ marginRight: 8 }}>
								End Color
								<ColorPicker
									color={config.endColor}
									onChange={(color) => {
										onSettingChange({
											id,
											config: { ...config, endColor: color }
										})
									}}
								></ColorPicker>
							</label>
						</SettingRow>
					</SettingSection>
				</>
			)}
			<DataSourceComponent
				useDataSource={props.useDataSources?.[0]}
				widgetId={props.id}
				onDataSourceCreated={(ds) => {
					setDataSource(ds as QueriableDataSource)
				}}
			/>
		</div>
	)
}
