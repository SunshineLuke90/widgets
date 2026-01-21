import { React, jsx, Immutable, type UseDataSource, DataSourceTypes, type IMFieldSchema } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { DataSourceSelector, FieldSelector } from 'jimu-ui/advanced/data-source-selector'
import type { IMConfig } from '../config'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import defaultMessages from './translations/default'
import './style.css'

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
    const { id, config, useMapWidgetIds } = props
    const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)

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
        }
    }

    // Save field selection to widget config under separate keys so each FieldSelector is independent
    const onFieldChange = (key: string, fields: IMFieldSchema[]) => {
        const fieldName = fields?.[0]?.jimuName ?? null
        const newConfig = (config || Immutable({})).set(key, fieldName)
        props.onSettingChange({ id, config: newConfig })
    }

    const onDataSourceChange = (useDataSources: UseDataSource[]) => {
        props.onSettingChange({ id: props.id, useDataSources: useDataSources })
    }

    return (
        <div className="view-layers-toggle-setting">

            <SettingSection title={props.intl.formatMessage({ id: 'mapSettings', defaultMessage: defaultMessages.mapSettings })}>
                <SettingRow flow="wrap" label={props.intl.formatMessage({ id: 'selectMapWidget', defaultMessage: defaultMessages.selectMapWidget })}>
                    <MapWidgetSelector onSelect={onMapSelected} useMapWidgetIds={useMapWidgetIds} />
                </SettingRow>
            </SettingSection>

            {/* If a map has been selected, set the ID to the map selected.*/}
            {useMapWidgetIds?.length > 0 && (
                <JimuMapViewComponent useMapWidgetId={useMapWidgetIds?.[0]} onActiveViewChange={onActiveViewChange} />
            )}

            {/* Once a map is selected, show the rest of the settings page. */}
            {jimuMapView && (
                <SettingSection title="Field info">
                    <SettingRow>
                        <DataSourceSelector
                            types={Immutable([DataSourceTypes.FeatureLayer])}
                            mustUseDataSource={true}
                            useDataSources={props.useDataSources}
                            useDataSourcesEnabled={props.useDataSourcesEnabled}
                            onChange={onDataSourceChange}
                            widgetId={props.id}
                        />
                    </SettingRow>
                    <SettingSection title="Toggle Base URL:">
                        <SettingRow>
                            <FieldSelector
                                useDataSources={props.useDataSources}
                                useDropdown={true}
                                isMultiple={false}
                                isDataSourceDropDownHidden={true}
                                onChange={(fields) => { onFieldChange('toggleBaseUrlField', fields) }}
                                selectedFields={config?.toggleBaseUrlField ? Immutable([config.toggleBaseUrlField]) : props.useDataSources?.[0]?.fields}
                            />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection title="Toggle Item URL Array:">
                        <SettingRow>
                            <FieldSelector
                                useDataSources={props.useDataSources}
                                useDropdown={true}
                                isMultiple={false}
                                isDataSourceDropDownHidden={true}
                                onChange={(fields) => { onFieldChange('toggleItemUrlArrayField', fields) }}
                                selectedFields={config?.toggleItemUrlArrayField ? Immutable([config.toggleItemUrlArrayField]) : props.useDataSources?.[0]?.fields}
                            />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection title="Constant URL Array:">
                        <SettingRow>
                            <FieldSelector
                                useDataSources={props.useDataSources}
                                useDropdown={true}
                                isMultiple={false}
                                isDataSourceDropDownHidden={true}
                                onChange={(fields) => { onFieldChange('constantUrlArrayField', fields) }}
                                selectedFields={config?.constantUrlArrayField ? Immutable([config.constantUrlArrayField]) : props.useDataSources?.[0]?.fields}
                            />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection title="Name:">
                        <SettingRow>
                            <FieldSelector
                                useDataSources={props.useDataSources}
                                useDropdown={true}
                                isMultiple={false}
                                isDataSourceDropDownHidden={true}
                                onChange={(fields) => { onFieldChange('nameField', fields) }}
                                selectedFields={config?.nameField ? Immutable([config.nameField]) : props.useDataSources?.[0]?.fields}
                            />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection title="Min Height:">
                        <SettingRow>
                            <FieldSelector
                                useDataSources={props.useDataSources}
                                useDropdown={true}
                                isMultiple={false}
                                isDataSourceDropDownHidden={true}
                                onChange={(fields) => { onFieldChange('minHeightField', fields) }}
                                selectedFields={config?.minHeightField ? Immutable([config.minHeightField]) : props.useDataSources?.[0]?.fields}
                            />
                        </SettingRow>
                    </SettingSection>

                    <SettingSection title="Max Height:">
                        <SettingRow>
                            <FieldSelector
                                useDataSources={props.useDataSources}
                                useDropdown={true}
                                isMultiple={false}
                                isDataSourceDropDownHidden={true}
                                onChange={(fields) => { onFieldChange('maxHeightField', fields) }}
                                selectedFields={config?.maxHeightField ? Immutable([config.maxHeightField]) : props.useDataSources?.[0]?.fields}
                            />
                        </SettingRow>
                    </SettingSection>
                </SettingSection>
            )}
        </div>
    )
}


