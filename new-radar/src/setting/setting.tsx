import { React, Immutable, type UseDataSource, DataSourceTypes, type IMFieldSchema } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import type { IMConfig } from '../config'

// Need to install hls.js using node.js for the camera viewer of this widget to function
// Run npm install hls.js in the client directory of your experience builder install

export default function Setting(props: AllWidgetSettingProps<IMConfig>) {
    const onMapSelected = (useMapWidgetIds: string[]) => {
        props.onSettingChange({
            id: props.id,
            useMapWidgetIds: useMapWidgetIds
        })
    }
    return (
        <div className="view-layers-toggle-setting">
            <SettingSection
                title={props.intl.formatMessage({
                    id: 'selectedMapLabel',
                    defaultMessage: "Select a map"
                })}
            >
                <SettingRow>
                    <MapWidgetSelector
                        onSelect={onMapSelected}
                        useMapWidgetIds={props.useMapWidgetIds}
                    />
                </SettingRow>
            </SettingSection>
        </div>
    )
}

