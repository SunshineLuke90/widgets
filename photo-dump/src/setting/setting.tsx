import {
  DataSourceTypes,
  Immutable,
  React,
  utils,
  type UseDataSource
} from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import {
  MapWidgetSelector,
  SettingRow,
  SettingSection
} from 'jimu-ui/advanced/setting-components'
import {
  DataSourceSelector,
  FieldSelector
} from 'jimu-ui/advanced/data-source-selector'
import { Button, Select, Switch, TextInput } from 'jimu-ui'
import type {
  IMConfig,
  PhotoFieldMapping,
  PhotoFieldSource
} from '../config'

const sourceOptions: Array<{ value: PhotoFieldSource, label: string }> = [
  { value: 'constant', label: 'Constant Value' },
  { value: 'fileName', label: 'Photo File Name' },
  { value: 'fileCreated', label: 'File Creation Timestamp (ISO)' },
  { value: 'photoTimestamp', label: 'Photo Timestamp (EXIF)' },
  { value: 'orientation', label: 'Photo Orientation (EXIF)' },
  { value: 'latitude', label: 'Latitude' },
  { value: 'longitude', label: 'Longitude' }
]

const createMapping = (): PhotoFieldMapping => ({
  id: `mapping-${utils.getUUID()}`,
  fieldName: '',
  label: '',
  source: 'constant',
  constantValue: '',
  exposeToUser: false
})

const getFieldMappings = (source: any): PhotoFieldMapping[] => {
  if (!source) return []
  if (typeof source.asMutable === 'function') {
    return source.asMutable({ deep: true })
  }
  return [...source]
}

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  const { id, config, onSettingChange } = props

  const fieldMappings = getFieldMappings(config?.fieldMappings)

  const patchConfig = (patch: Partial<IMConfig>) => {
    onSettingChange({
      id,
      config: {
        ...config,
        ...patch
      }
    })
  }

  const onMapSelected = (useMapWidgetIds: string[]) => {
    onSettingChange({
      id: id,
      useMapWidgetIds: useMapWidgetIds
    })
  }

  const onDataSourceChange = (useDataSources: UseDataSource[]) => {
    onSettingChange({
      id,
      useDataSources
    })
  }

  const updateMapping = (mappingId: string, patch: Partial<PhotoFieldMapping>) => {
    patchConfig({
      fieldMappings: fieldMappings.map((mapping) =>
        mapping.id === mappingId ? { ...mapping, ...patch } : mapping
      )
    } as any)
  }

  const removeMapping = (mappingId: string) => {
    patchConfig({
      fieldMappings: fieldMappings.filter((mapping) => mapping.id !== mappingId)
    } as any)
  }

  const addMapping = () => {
    patchConfig({
      fieldMappings: [...fieldMappings, createMapping()]
    } as any)
  }

  return (
    <div className="photo-dump-setting p-2">
      <SettingSection title="Map for Photo Geolocation">
        <SettingRow label="Map Widget" flow="wrap">
          <MapWidgetSelector
            onSelect={onMapSelected}
            useMapWidgetIds={props.useMapWidgetIds}
          />
        </SettingRow>
      </SettingSection>
      <SettingSection title="Target Layer">
        <SettingRow label="Feature Layer" flow="wrap">
          <DataSourceSelector
            types={Immutable.from([DataSourceTypes.FeatureLayer])}
            mustUseDataSource={true}
            isMultiple={false}
            useDataSources={props.useDataSources}
            useDataSourcesEnabled={props.useDataSourcesEnabled}
            onChange={onDataSourceChange}
            widgetId={props.id}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Defaults and Field Mapping">
        <SettingRow flow="no-wrap" label="Allow End User Overrides before upload">
          <Switch
            checked={Boolean(config?.allowUserOverrides)}
            onChange={(evt) => {
              patchConfig({ allowUserOverrides: evt.target.checked } as any)
            }}
          />
        </SettingRow>

        {fieldMappings.map((mapping) => (
          <div key={mapping.id} className="p-2 mb-2 border rounded-1">
            <SettingRow label="Layer Field" flow="wrap">
              <FieldSelector
                useDataSources={props.useDataSources}
                useDropdown={true}
                isMultiple={false}
                isDataSourceDropDownHidden={true}
                selectedFields={
                  mapping.fieldName
                    ? Immutable.from([mapping.fieldName])
                    : Immutable.from([])
                }
                onChange={(fields) => {
                  updateMapping(mapping.id, {
                    fieldName: fields?.[0]?.jimuName ?? ''
                  })
                }}
              />
            </SettingRow>
            <SettingRow label="Display Label" flow="wrap">
              <TextInput
                value={mapping.label ?? ''}
                placeholder="e.g. Feature Type"
                onChange={(evt) => {
                  updateMapping(mapping.id, { label: evt.currentTarget.value })
                }}
              />
            </SettingRow>
            <SettingRow label="Default Source" flow="wrap">
              <Select
                value={mapping.source}
                onChange={(evt) => {
                  updateMapping(mapping.id, {
                    source: evt.target.value as PhotoFieldSource
                  })
                }}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </SettingRow>

            {mapping.source === 'constant' && (
              <SettingRow label="Constant Value" flow="wrap">
                <TextInput
                  value={mapping.constantValue ?? ''}
                  placeholder="Default value"
                  onChange={(evt) => {
                    updateMapping(mapping.id, {
                      constantValue: evt.currentTarget.value
                    })
                  }}
                />
              </SettingRow>
            )}

            <SettingRow flow="no-wrap" label="Expose Field to End Users">
              <Switch
                checked={Boolean(mapping.exposeToUser)}
                onChange={(evt) => {
                  updateMapping(mapping.id, { exposeToUser: evt.target.checked })
                }}
              />
            </SettingRow>

            <SettingRow flow="wrap">
              <Button
                size="sm"
                type="tertiary"
                onClick={() => {
                  removeMapping(mapping.id)
                }}
              >
                Remove Field Mapping
              </Button>
            </SettingRow>
          </div>
        ))}

        <SettingRow flow="wrap">
          <Button type="secondary" onClick={addMapping}>
            Add Field Mapping
          </Button>
        </SettingRow>
      </SettingSection>
    </div>
  )
}