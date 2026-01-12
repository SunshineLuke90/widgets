import { Immutable, type UseDataSource, DataSourceTypes, type IMFieldSchema } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import {MapWidgetSelector,SettingRow,SettingSection} from 'jimu-ui/advanced/setting-components'
import defaultI18nMessages from './translations/default'
import type { IMConfig } from '../config'
import { DataSourceSelector, FieldSelector } from 'jimu-ui/advanced/data-source-selector'

// Need to install hls.js using node.js for the camera viewer of this widget to function
// Run npm install hls.js in the client directory of your experience builder install

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
  const { id, config, useMapWidgetIds } = props

  const onMapSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds: useMapWidgetIds
    })
  }

    // Save field selection to widget config under separate keys so each FieldSelector is independent
    const onFieldChange = (key: string, fields: IMFieldSchema[]) => {
        const fieldName = fields?.[0]?.jimuName ?? null
        const newConfig = (config || Immutable({})).set(key, fieldName)
        props.onSettingChange({ id, config: newConfig })
    }

  const onDataSourceChange = (useDataSources: UseDataSource[]) => {
    props.onSettingChange({
      id: props.id,
      useDataSources: useDataSources
    })
  }

  return (
    <div className="view-layers-toggle-setting">
      <SettingSection
        title={props.intl.formatMessage({
          id: 'selectedMapLabel',
          defaultMessage: defaultI18nMessages.selectedMap
        })}
      >
        <SettingRow
          label={"Select Map Widget"}
          level={1}
          flow={'wrap'}
          tag={'label'}
        >
          <MapWidgetSelector
            onSelect={onMapSelected}
            useMapWidgetIds={useMapWidgetIds}
          />
        </SettingRow>
        <SettingRow
          label={"Select Data Source"}
          level={1}
          flow={'wrap'}
          tag={'label'}
        >
          <DataSourceSelector
            types={Immutable([DataSourceTypes.FeatureLayer])}
            mustUseDataSource={true}
            useDataSources={props.useDataSources}
            useDataSourcesEnabled={props.useDataSourcesEnabled}
            onChange={onDataSourceChange}
            widgetId={props.id}
          />
        </SettingRow>
        <SettingRow
          label={"Select Label Field"}
          level={2}
          flow={'wrap'}
          tag={'label'}
        >
          <FieldSelector
            useDataSources={props.useDataSources}
            useDropdown={true}
            isMultiple={false}
            isDataSourceDropDownHidden={true}
            onChange={(fields) => onFieldChange('labelField', fields)}
            selectedFields={config?.labelField ? Immutable([config.labelField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
        <SettingRow
          label={"Start Date Field"}
          level={1}
          flow={'wrap'}
          tag={'label'}
        >
          <FieldSelector
            useDataSources={props.useDataSources}
            useDropdown={true}
            isMultiple={false}
            isDataSourceDropDownHidden={true}
            onChange={(fields) => onFieldChange('startDateField', fields)}
            selectedFields={config?.startDateField ? Immutable([config.startDateField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
        <SettingRow
          label={"End Date Field"}
          level={2}
          flow={'wrap'}
          tag={'label'}
        >
          <FieldSelector
            useDataSources={props.useDataSources}
            useDropdown={true}
            isMultiple={false}
            isDataSourceDropDownHidden={true}
            onChange={(fields) => onFieldChange('endDateField', fields)}
            selectedFields={config?.endDateField ? Immutable([config.endDateField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
        <SettingRow
          label={"All Day Field"}
          level={2}
          flow={'wrap'}
          tag={'label'}
        >
          <FieldSelector
            useDataSources={props.useDataSources}
            useDropdown={true}
            isMultiple={false}
            isDataSourceDropDownHidden={true}
            onChange={(fields) => onFieldChange('allDayField', fields)}
            selectedFields={config?.allDayField ? Immutable([config.allDayField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
        <SettingRow
          label={"Description Field"}
          level={2}
          flow={'wrap'}
          tag={'label'}
        >
          <FieldSelector
            useDataSources={props.useDataSources}
            useDropdown={true}
            isMultiple={false}
            isDataSourceDropDownHidden={true}
            onChange={(fields) => onFieldChange('descriptionField', fields)}
            selectedFields={config?.descriptionField ? Immutable([config.descriptionField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}

