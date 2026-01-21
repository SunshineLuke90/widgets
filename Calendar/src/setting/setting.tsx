import { Immutable, type UseDataSource, DataSourceTypes, type IMFieldSchema, utils } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import {MapWidgetSelector,SettingRow,SettingSection} from 'jimu-ui/advanced/setting-components'
import { Button, TextInput } from 'jimu-ui'
import defaultI18nMessages from './translations/default'
import type { IMConfig, colorset } from '../config'
import { DataSourceSelector, FieldSelector } from 'jimu-ui/advanced/data-source-selector'

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


  const onConfigChange = (value: colorset[]) => {
      const newConfig = (config || Immutable({})).set('colorsets', value)
      props.onSettingChange({ id, config: newConfig })
  }

  const addValue = () => {
      const newValue: colorset = {
          id: `view_${utils.getUUID()}`,
          fieldValue: ``,
          color: `#000000`
      }
      const newcolorsets = config.colorsets ? [...config.colorsets, newValue] : [newValue]
      onConfigChange(newcolorsets)
  }

  const removeValue = (viewId: string) => {
      const newcolorsets = config.colorsets.filter(v => v.id !== viewId)
      onConfigChange(newcolorsets.asMutable({ deep: true }))
  }

  const updateValue = (viewId: string, newViewData: Partial<colorset>) => {
      const newcolorsets = config.colorsets.map(v => {
          if (v.id === viewId) {
              return { ...v, ...newViewData }
          }
          return v
      })
      onConfigChange(newcolorsets.asMutable({ deep: true }))
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
            onChange={(fields) => { onFieldChange('labelField', fields) }}
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
            onChange={(fields) => { onFieldChange('startDateField', fields) }}
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
            onChange={(fields) => { onFieldChange('endDateField', fields) }}
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
            onChange={(fields) => { onFieldChange('allDayField', fields) }}
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
            onChange={(fields) => { onFieldChange('descriptionField', fields) }}
            selectedFields={config?.descriptionField ? Immutable([config.descriptionField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
      </SettingSection>
      <SettingSection
        title={"Event Color Settings"}
      >
        <SettingRow
          label={"Default Event Color"}
          level={1}
          flow={'wrap'}
          tag={'label'}
        >
          <input
            type="color"
            value={config?.defaultEventColor || '#3788d8'}
            onChange={(e) => {
              const newConfig = (config || Immutable({})).set('defaultEventColor', e.target.value)
              props.onSettingChange({ id, config: newConfig })
            }}
          />
        </SettingRow>
        <SettingRow
          label={"Color Field"}
          level={2}
          flow={'wrap'}
          tag={'label'}
        >
          <FieldSelector
            useDataSources={props.useDataSources}
            useDropdown={true}
            isMultiple={false}
            isDataSourceDropDownHidden={true}
            onChange={(fields) => { onFieldChange('colorsetField', fields) }}
            selectedFields={config?.colorsetField ? Immutable([config.colorsetField]) : props.useDataSources?.[0]?.fields}
          />
        </SettingRow>
        <SettingRow
          label={"Map field values to colors"}
          level={2}
          flow={'wrap'}
          tag={'div'}
        >
          {config.colorsets?.map((value, index) => (
            <div key={value.id} className="value-config-container">
              <SettingRow
                label={`${props.intl.formatMessage({ id: 'Color'})} ${index + 1}`}
                flow="no-wrap"
                level={3}
              >
                <Button size="sm" type="tertiary" onClick={() => { removeValue(value.id) }}>Remove</Button>
              </SettingRow>
              <SettingRow
                flow="wrap"
                label={props.intl.formatMessage({ id: 'Value to Color'})}
                level={1}
              >
                <TextInput
                  size="sm"
                  value={value.fieldValue}
                  onChange={(e) => {
                    updateValue(value.id, { fieldValue: e.currentTarget.value })
                  }}
                />
                <input
                  type="color"
                  value={value.color || '#3788d8'}
                  onChange={(e) => {
                    updateValue(value.id, { color: e.currentTarget.value })
                  }}
                />
              </SettingRow>
            </div>
          ))}
          <Button type="primary" className="w-100 mt-2" onClick={addValue}>
              {props.intl.formatMessage({ id: 'Add Color'})}
          </Button>
        </SettingRow>
      </SettingSection>
    </div>
  )
}

