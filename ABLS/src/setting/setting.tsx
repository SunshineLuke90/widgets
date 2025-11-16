import { React, jsx, utils } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { IconPicker } from 'jimu-ui/advanced/resource-selector'
import { Button, TextInput, Checkbox, Switch, NumericInput } from 'jimu-ui'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type { IMConfig, ABLSView } from '../config'
import defaultMessages from './translations/default'
import { getLayersFromJimuMapView } from './utils'
import './style.css'

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
    const { id, config, onSettingChange, useMapWidgetIds } = props
    const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
    const [layers, setLayers] = React.useState<__esri.Layer[]>(null)

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
            setLayers(getLayersFromJimuMapView(jmv))
        }
    }

    const onConfigChange = (value: ABLSView[]) => {
        onSettingChange({
            id: id,
            config: {
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
        const newViews = config.views.filter(v => v.id !== viewId)
        onConfigChange(newViews)
    }

    const updateView = (viewId: string, newViewData: Partial<ABLSView>) => {
        const newViews = config.views.map(v => {
            if (v.id === viewId) {
                return { ...v, ...newViewData }
            }
            return v
        })
        onConfigChange(newViews)
    }

    const onLayerCheckChange = (view: ABLSView, layerId: string, checked: boolean) => {
        let newLayerIds = view.layerIds ? [...view.layerIds] : []
        if (checked) {
            if (!newLayerIds.includes(layerId)) {
                newLayerIds.push(layerId)
            }
        } else {
            newLayerIds = newLayerIds.filter(id => id !== layerId)
        }
        updateView(view.id, { layerIds: newLayerIds })
    }

    return (
        <div className='widget-setting-abls'>
            <SettingSection title={props.intl.formatMessage({ id: 'mapSettings', defaultMessage: defaultMessages.mapSettings })}>
                <SettingRow flow="wrap" label={props.intl.formatMessage({ id: 'selectMapWidget', defaultMessage: defaultMessages.selectMapWidget })}>
                    <MapWidgetSelector onSelect={onMapSelected} useMapWidgetIds={useMapWidgetIds} />
                </SettingRow>
            </SettingSection>

            {useMapWidgetIds?.length > 0 && (
                <JimuMapViewComponent useMapWidgetId={useMapWidgetIds?.[0]} onActiveViewChange={onActiveViewChange} />
            )}

            {jimuMapView && (
                <SettingSection title={props.intl.formatMessage({ id: 'viewSettings', defaultMessage: defaultMessages.viewSettings })}>
                    {config.views?.map((view, index) => (
                        <div key={view.id} className="view-config-container">
                            <SettingRow label={`${props.intl.formatMessage({ id: 'view', defaultMessage: defaultMessages.view })} ${index + 1}`}>
                                <Button size="sm" type="tertiary" onClick={() => { removeView(view.id); }}>Remove</Button>
                            </SettingRow>
                            <SettingRow flow="wrap" label={props.intl.formatMessage({ id: 'viewName', defaultMessage: defaultMessages.viewName })}>
                                <TextInput
                                    size="sm"
                                    value={view.name}
                                    onChange={(e) => {
                                        updateView(view.id, { name: e.currentTarget.value });
                                    }}
                                />
                            </SettingRow>
                            <SettingRow label={props.intl.formatMessage({ id: 'icon', defaultMessage: defaultMessages.icon })}>
                                <IconPicker
                                    icon={view.icon}
                                    onChange={(icon) => { updateView(view.id, { icon: icon }); }}
                                />
                            </SettingRow>
                            <SettingRow flow="wrap" label={props.intl.formatMessage({ id: 'visibleLayers', defaultMessage: defaultMessages.visibleLayers })} />
                            <div className="layer-list">
                                {layers?.map(layer => (
                                    <SettingRow key={layer.id}>
                                        <Checkbox
                                            checked={view.layerIds?.includes(layer.id)}
                                            onChange={(e, checked) => { onLayerCheckChange(view, layer.id, checked); }}
                                        />
                                        <label className="ml-2">{layer.title}</label>
                                    </SettingRow>
                                ))}
                            </div>
                            <SettingRow label="Enable Time Filter" className="mt-3 border-top pt-3">
                                <Switch
                                    checked={view.timeEnabled ?? false}
                                    onChange={(evt) => { updateView(view.id, { timeEnabled: evt.target.checked }); }}
                                />
                            </SettingRow>
                            {view.timeEnabled && (
                                <div className="pl-1">
                                    <SettingRow flow="wrap" label="Start Day Offset">
                                        <NumericInput
                                            className="w-100"
                                            placeholder="e.g., 0 for today, 1 for tomorrow"
                                            value={view.startOffset}
                                            onAcceptValue={(value) => { updateView(view.id, { startOffset: Number(value) }); }}
                                        />
                                    </SettingRow>
                                    <SettingRow flow="wrap" label="End Day Offset">
                                        <NumericInput
                                            className="w-100"
                                            placeholder="e.g., 0 for today, 1 for tomorrow"
                                            value={view.endOffset}
                                            onAcceptValue={(value) => { updateView(view.id, { endOffset: Number(value) }); }}
                                        />
                                    </SettingRow>
                                </div>
                            )}
                        </div>
                    ))}
                    <Button type="primary" className="w-100 mt-2" onClick={addView}>
                        {props.intl.formatMessage({ id: 'addView', defaultMessage: defaultMessages.addView })}
                    </Button>
                </SettingSection>
            )}
        </div>
    )
}


