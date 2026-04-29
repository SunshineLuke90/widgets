import {
	Immutable,
	type UseDataSource,
	DataSourceTypes,
	type IMFieldSchema
} from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import {
	MapWidgetSelector,
	SettingRow,
	SettingSection
} from "jimu-ui/advanced/setting-components"
import { Switch } from "jimu-ui"
import defaultI18nMessages from "./translations/default"
import type { IMConfig } from "../config"
import {
	DataSourceSelector,
	FieldSelector
} from "jimu-ui/advanced/data-source-selector"
import { IconPicker } from "jimu-ui/advanced/resource-selector"

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
	const onMapSelected = (useMapWidgetIds: string[]) => {
		props.onSettingChange({
			id: props.id,
			useMapWidgetIds: useMapWidgetIds
		})
	}

	const onFieldsChange = (fields: IMFieldSchema[]) => {
		const useDataSource = props.useDataSources[0]
			.set(
				"fields",
				fields?.map((f) => f.jimuName)
			)
			.asMutable({ deep: true })
		// Save the selected fields to widget json.
		props.onSettingChange({
			id: props.id,
			useDataSources: [useDataSource]
		})
	}

	const onDataSourceChange = (useDataSources: UseDataSource[]) => {
		props.onSettingChange({
			id: props.id,
			useDataSources: useDataSources
		})
	}

	const onIconChange = (icon: any) => {
		props.onSettingChange({
			id: props.id,
			config: {
				icon: icon
			}
		})
	}
	return (
		<div className="view-layers-toggle-setting">
			<SettingSection
				title={props.intl.formatMessage({
					id: "selectedMapLabel",
					defaultMessage: defaultI18nMessages.selectedMap
				})}
			>
				<SettingRow>
					<MapWidgetSelector
						onSelect={onMapSelected}
						useMapWidgetIds={props.useMapWidgetIds}
					/>
				</SettingRow>
				<SettingRow>
					<IconPicker
						icon={props.config?.icon as any}
						onChange={onIconChange}
					/>
				</SettingRow>
				<SettingRow
					label={"Enable Multiple Camera Support"}
				>
					<Switch
						checked={props.config?.multiple || false}
						onChange={() => {
							props.onSettingChange({
								id: props.id,
								config: {
									...props.config,
									multiple: !props.config?.multiple
								}
							})
						}}
					/>
				</SettingRow>
				<SettingRow>
					<DataSourceSelector
						types={Immutable.from([DataSourceTypes.FeatureLayer])}
						mustUseDataSource={true}
						useDataSources={props.useDataSources}
						useDataSourcesEnabled={props.useDataSourcesEnabled}
						onChange={onDataSourceChange}
						widgetId={props.id}
					/>
				</SettingRow>
				<SettingRow>
					<FieldSelector
						useDataSources={props.useDataSources}
						useDropdown={true}
						isMultiple={false}
						isDataSourceDropDownHidden={true}
						onChange={onFieldsChange}
						selectedFields={props.useDataSources?.[0].fields}
					/>
				</SettingRow>
			</SettingSection>
		</div>
	)
}
