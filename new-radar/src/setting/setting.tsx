import type { AllWidgetSettingProps } from "jimu-for-builder"
import {
	MapWidgetSelector,
	SettingRow,
	SettingSection
} from "jimu-ui/advanced/setting-components"
import { React } from "jimu-core"
import type { IMConfig } from "../config"
import { Option, Select } from "jimu-ui"
import { JimuMapViewComponent, type JimuMapView } from "jimu-arcgis"

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
	const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
	const [layers, setLayers] = React.useState<__esri.Layer[]>(null)

	const onMapSelected = (useMapWidgetIds: string[]) => {
		props.onSettingChange({
			id: props.id,
			useMapWidgetIds: useMapWidgetIds
		})
	}

	const onActiveViewChange = (jmv: JimuMapView) => {
		if (jmv) {
			setJimuMapView(jmv)
			// Flatten the layers from the map for easier use
			const unfilteredLayers = jmv?.view?.map?.layers
				? jmv.view.map.layers.toArray().reverse()
				: []
			// Filter out layers that have identical IDs (keeping the first occurrence)
			const uniqueLayers = unfilteredLayers.filter(
				(layer, index, self) =>
					index === self.findIndex((l) => l.id === layer.id)
			)
			setLayers(uniqueLayers)
		}
	}

	return (
		<div className="view-layers-toggle-setting">
			<SettingSection>
				<SettingRow
					label={props.intl.formatMessage({
						id: "selectedMapLabel",
						defaultMessage: "Select a map"
					})}
					bottomLine={true}
					flow={"wrap"}
					level={1}
				>
					<MapWidgetSelector
						onSelect={onMapSelected}
						useMapWidgetIds={props.useMapWidgetIds}
					/>
				</SettingRow>
			</SettingSection>
			{props.useMapWidgetIds?.length > 0 && (
				<JimuMapViewComponent
					useMapWidgetId={props.useMapWidgetIds?.[0]}
					onActiveViewChange={onActiveViewChange}
				/>
			)}
			{jimuMapView && (
				<SettingSection>
					<SettingRow
						label={props.intl.formatMessage({
							id: "radarTypeLabel",
							defaultMessage: "Radar Type"
						})}
						flow={"wrap"}
						level={2}
					>
						<Select
							value={props.config.radarType}
							onChange={(e) => {
								props.onSettingChange({
									id: props.id,
									config: props.config.set("radarType", e.target.value)
								})
							}}
						>
							<Option value="Precipitation">Precipitation</Option>
							<Option value="Imagery">Imagery</Option>
						</Select>
					</SettingRow>
					<SettingRow
						label={props.intl.formatMessage({
							id: "placementLayerLabel",
							defaultMessage: "Placement Layer"
						})}
						flow={"wrap"}
						level={2}
					>
						<Select
							value={props.config.placementLayer}
							onChange={(e) => {
								props.onSettingChange({
									id: props.id,
									config: props.config.set("placementLayer", e.target.value)
								})
							}}
						>
							<Option value={null}>-- None --</Option>
							{layers &&
								layers.map((layer) => (
									<Option key={layer.id} value={layer.id}>
										{layer.title || layer.id}
									</Option>
								))}
						</Select>
					</SettingRow>
				</SettingSection>
			)}
		</div>
	)
}
