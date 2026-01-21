import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import type { IMConfig } from '../config'

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

