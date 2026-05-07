import { React, utils } from "jimu-core"
import type { AllWidgetSettingProps } from "jimu-for-builder"
import {
	MapWidgetSelector,
	SettingSection,
	SettingRow
} from "jimu-ui/advanced/setting-components"
import { IconPicker } from "jimu-ui/advanced/resource-selector"
import { Button, TextInput, Switch, NumericInput } from "jimu-ui"
import { JimuMapViewComponent, type JimuMapView } from "jimu-arcgis"
import type Layer from "esri/layers/Layer"
import type { IMConfig, ABLSView } from "../config"
import defaultMessages from "./translations/default"
import { buildLayerTreeRoot, getLayersFromJimuMapView, parseLayerTreeUpdate, toLayerKey, updateExpandedKeysByViewId } from "./utils"
// @ts-expect-error - No types available for this package
import "./style.css"
import { Tree, TreeAlignmentType, TreeCollapseStyle, TreeStyle, type UpdateTreeActionDataType } from "jimu-ui/basic/list-tree"

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
	const { id, config, onSettingChange, useMapWidgetIds } = props
	const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
	const [layers, setLayers] = React.useState<Layer[]>(null)
	const [selectedTreeItemKeysByViewId, setSelectedTreeItemKeysByViewId] = React.useState<{ [viewId: string]: string[] }>({})
	const [expandedTreeItemKeysByViewId, setExpandedTreeItemKeysByViewId] = React.useState<{ [viewId: string]: string[] }>({})
	const [selectedExpandTreeItemKeysByViewId, setSelectedExpandTreeItemKeysByViewId] = React.useState<{ [viewId: string]: string[] }>({})
	const [expandedExpandTreeItemKeysByViewId, setExpandedExpandTreeItemKeysByViewId] = React.useState<{ [viewId: string]: string[] }>({})

	const onMapSelected = (useMapWidgetIds: string[]) => {
		onSettingChange({
			id: id,
			useMapWidgetIds: useMapWidgetIds
		})
	}

	const onActiveViewChange = (jmv: JimuMapView) => {
		if (jmv) {
			setJimuMapView(jmv)
			// Flatten the layers from the map for easier use
			setLayers(getLayersFromJimuMapView(jmv).reverse())
		}
	}

	const onConfigChange = (value: ABLSView[]) => {
		onSettingChange({
			id: id,
			config: {
				...config,
				views: value
			}
		})
	}

	const addView = () => {
		const newView: ABLSView = {
			id: `view_${utils.getUUID()}`,
			name: `View ${config.views?.length ? config.views.length + 1 : 1}`,
			icon: null,
			layerIds: [],
			timeEnabled: false,
			startOffset: 0,
			endOffset: 0
		}
		const newViews = config.views ? [...config.views, newView] : [newView]
		onConfigChange(newViews)
	}

	const removeView = (viewId: string) => {
		const newViews = config.views.filter((v) => v.id !== viewId)
		onConfigChange(newViews)
	}

	const updateView = (viewId: string, newViewData: Partial<ABLSView>) => {
		const newViews = config.views.map((v) => {
			if (v.id === viewId) {
				return { ...v, ...newViewData }
			}
			return v
		})
		onConfigChange(newViews)
	}

	const onLayerCheckChange = (
		view: ABLSView,
		layerId: string,
		checked: boolean
	) => {
		const targetLayerId = toLayerKey(layerId)
		const currentLayerIds = (selectedTreeItemKeysByViewId[view.id] ?? view.layerIds ?? []).map((id) => toLayerKey(id))
		let newLayerIds = [...currentLayerIds]
		if (checked) {
			if (!newLayerIds.includes(targetLayerId)) {
				newLayerIds.push(targetLayerId)
			}
		} else {
			newLayerIds = newLayerIds.filter((id) => id !== targetLayerId)
		}

		setSelectedTreeItemKeysByViewId((prev) => ({
			...prev,
			[view.id]: newLayerIds
		}))

		updateView(view.id, { layerIds: newLayerIds })
	}

	const onExpandLayerCheckChange = (
		view: ABLSView,
		layerId: string,
		checked: boolean
	) => {
		const targetLayerId = toLayerKey(layerId)
		const currentLayerIds = (selectedExpandTreeItemKeysByViewId[view.id] ?? view.expandLayerIds ?? []).map((id) => toLayerKey(id))
		let newLayerIds = [...currentLayerIds]
		if (checked) {
			if (!newLayerIds.includes(targetLayerId)) {
				newLayerIds.push(targetLayerId)
			}
		} else {
			newLayerIds = newLayerIds.filter((id) => id !== targetLayerId)
		}

		setSelectedExpandTreeItemKeysByViewId((prev) => ({
			...prev,
			[view.id]: newLayerIds
		}))

		updateView(view.id, { expandLayerIds: newLayerIds })
	}

	const handleGenericLayerTreeUpdate = (
		view: ABLSView,
		actionData: UpdateTreeActionDataType,
		setExpandedKeysByViewId: React.Dispatch<React.SetStateAction<{ [viewId: string]: string[] }>>,
		onCheckboxChange: (view: ABLSView, layerId: string, checked: boolean) => void
	) => {
		const update = parseLayerTreeUpdate(actionData)

		if (update.kind === "expand") {
			setExpandedKeysByViewId((previousState) => {
				return updateExpandedKeysByViewId(previousState, view.id, update.layerId, update.expanded)
			})
			return
		}

		if (update.kind === "checkbox") {
			onCheckboxChange(view, update.layerId, update.checked)
		}
	}

	const getSelectedLayerIdsForView = (view: ABLSView): string[] => {
		return (selectedTreeItemKeysByViewId[view.id] ?? view.layerIds ?? []).map((id) => toLayerKey(id))
	}

	const getSelectedExpandLayerIdsForView = (view: ABLSView): string[] => {
		return (selectedExpandTreeItemKeysByViewId[view.id] ?? view.expandLayerIds ?? []).map((id) => toLayerKey(id))
	}

	const getTreeRenderKey = (view: ABLSView): string => {
		const selected = getSelectedLayerIdsForView(view).join("|")
		const expanded = (expandedTreeItemKeysByViewId[view.id] ?? []).map((id) => toLayerKey(id)).join("|")
		return `${view.id}::${selected}::${expanded}`
	}

	const getExpandTreeRenderKey = (view: ABLSView): string => {
		const selected = getSelectedExpandLayerIdsForView(view).join("|")
		const expanded = (expandedExpandTreeItemKeysByViewId[view.id] ?? []).map((id) => toLayerKey(id)).join("|")
		return `${view.id}::expand::${selected}::${expanded}`
	}

	return (
		<div className="widget-setting-abls">
			<SettingSection
				title={props.intl.formatMessage({
					id: "mapSettings",
					defaultMessage: defaultMessages.mapSettings
				})}
			>
				<SettingRow
					flow="wrap"
					label={props.intl.formatMessage({
						id: "selectMapWidget",
						defaultMessage: defaultMessages.selectMapWidget
					})}
				>
					<MapWidgetSelector
						onSelect={onMapSelected}
						useMapWidgetIds={useMapWidgetIds}
					/>
				</SettingRow>
			</SettingSection>

			{useMapWidgetIds?.length > 0 && (
				<JimuMapViewComponent
					useMapWidgetId={useMapWidgetIds?.[0]}
					onActiveViewChange={onActiveViewChange}
				/>
			)}

			<SettingSection
				title={props.intl.formatMessage({
					id: "enableExpand",
					defaultMessage: defaultMessages.enableExpand
				})}
			>
				<SettingRow label="Enable Layer Expansion">
					<Switch
						checked={config.expandEnabled ?? false}
						onChange={(evt) => {
							onSettingChange({
								id: id,
								config: {
									...config,
									expandEnabled: evt.target.checked
								}
							})
						}}
					/>
				</SettingRow>
			</SettingSection>

			{jimuMapView && (
				<SettingSection
					title={props.intl.formatMessage({
						id: "viewSettings",
						defaultMessage: defaultMessages.viewSettings
					})}
				>
					{config.views?.map((view, index) => (
						<div key={view.id} className="view-config-container">
							<SettingRow
								label={`${props.intl.formatMessage({ id: "view", defaultMessage: defaultMessages.view })} ${index + 1}`}
							>
								<Button
									size="sm"
									type="tertiary"
									onClick={() => {
										removeView(view.id)
									}}
								>
									Remove
								</Button>
							</SettingRow>
							<SettingRow
								flow="wrap"
								label={props.intl.formatMessage({
									id: "viewName",
									defaultMessage: defaultMessages.viewName
								})}
							>
								<TextInput
									size="sm"
									value={view.name}
									onChange={(e) => {
										updateView(view.id, { name: e.currentTarget.value })
									}}
								/>
							</SettingRow>
							<SettingRow
								label={props.intl.formatMessage({
									id: "icon",
									defaultMessage: defaultMessages.icon
								})}
							>
								<IconPicker
									icon={view.icon}
									onChange={(icon) => {
										updateView(view.id, { icon: icon as any })
									}}
								/>
							</SettingRow>
							<SettingRow
								flow="wrap"
								label={props.intl.formatMessage({
									id: "visibleLayers",
									defaultMessage: defaultMessages.visibleLayers
								})}
							/>
							<div className="Replacement-layer-list layer-list">
								<Tree
									key={getTreeRenderKey(view)}
									className="w-100"
									size="sm"
									collapseStyle={TreeCollapseStyle.Arrow}
									dndEnabled={false}
									isMultiSelection={true}
									checkboxLinkage={false}
									treeAlignmentType={TreeAlignmentType.Intact}
									disableDoubleClickTitle={true}
									treeStyle={TreeStyle.Basic}
									singleLineText={true}
									rootItemVisible={false}
									onUpdateItem={(actionData) => {
										handleGenericLayerTreeUpdate(
											view,
											actionData,
											setExpandedTreeItemKeysByViewId,
											onLayerCheckChange
										)
									}}
									rootItemJson={buildLayerTreeRoot(
										layers,
										getSelectedLayerIdsForView(view),
										expandedTreeItemKeysByViewId[view.id] ?? []
									)}
								/>
							</div>
							{config.expandEnabled && (
								<>
									<SettingRow
										flow="wrap"
										label={props.intl.formatMessage({
											id: "expandLayers",
											defaultMessage: defaultMessages.expandLayers
										})}
									/>
									<div className="Replacement-layer-list layer-list">
										<Tree
											key={getExpandTreeRenderKey(view)}
											className="w-100"
											size="sm"
											collapseStyle={TreeCollapseStyle.Arrow}
											dndEnabled={false}
											isMultiSelection={true}
											checkboxLinkage={false}
											treeAlignmentType={TreeAlignmentType.Intact}
											disableDoubleClickTitle={true}
											treeStyle={TreeStyle.Basic}
											singleLineText={true}
											rootItemVisible={false}
											onUpdateItem={(actionData) => {
												handleGenericLayerTreeUpdate(
													view,
													actionData,
													setExpandedExpandTreeItemKeysByViewId,
													onExpandLayerCheckChange
												)
											}}
											rootItemJson={buildLayerTreeRoot(
												layers,
												getSelectedExpandLayerIdsForView(view),
												expandedExpandTreeItemKeysByViewId[view.id] ?? []
											)}
										/>
									</div>
								</>
							)}
							<SettingRow
								label="Enable Time Filter"
								className="mt-3 border-top pt-3"
							>
								<Switch
									checked={view.timeEnabled ?? false}
									onChange={(evt) => {
										updateView(view.id, { timeEnabled: evt.target.checked })
									}}
								/>
							</SettingRow>
							{view.timeEnabled && (
								<div className="pl-1">
									<SettingRow flow="wrap" label="Start Day Offset">
										<NumericInput
											className="w-100"
											placeholder="e.g., 0 for today, 1 for tomorrow"
											value={view.startOffset}
											onAcceptValue={(value) => {
												updateView(view.id, { startOffset: Number(value) })
											}}
										/>
									</SettingRow>
									<SettingRow flow="wrap" label="End Day Offset">
										<NumericInput
											className="w-100"
											placeholder="e.g., 0 for today, 1 for tomorrow"
											value={view.endOffset}
											onAcceptValue={(value) => {
												updateView(view.id, { endOffset: Number(value) })
											}}
										/>
									</SettingRow>
								</div>
							)}
						</div>
					))}
					<Button type="primary" className="w-100 mt-2" onClick={addView}>
						{props.intl.formatMessage({
							id: "addView",
							defaultMessage: defaultMessages.addView
						})}
					</Button>
				</SettingSection>
			)}
		</div>
	)
}
