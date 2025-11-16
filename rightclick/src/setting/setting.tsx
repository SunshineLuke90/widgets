import { React, Immutable } from 'jimu-core';
import { AllWidgetSettingProps } from 'jimu-for-builder';
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components';
import { SymbolSelector, JimuSymbolType } from 'jimu-ui/advanced/map';
import { PlusOutlined } from 'jimu-icons/outlined/editor/plus';
import { TrashOutlined } from 'jimu-icons/outlined/editor/trash';
import { RefreshOutlined } from 'jimu-icons/outlined/editor/refresh';
import {
    Switch,
    Radio,
    TextInput,
    Button,
    Select,
    Option,
    Icon,
    Tooltip,
    NumericInput,
    Alert,
    Checkbox,
    Loading
} from 'jimu-ui';
import { IMConfig, FeatureLayerConfig } from '../config';

// Define the field interface
interface ServiceField {
    name: string;
    alias: string;
    type: string;
}

const Setting = (props: AllWidgetSettingProps<IMConfig>) => {
    const { config } = props;

    // State for managing field loading
    const [fieldStates, setFieldStates] = React.useState<{
        [index: number]: {
            fields: ServiceField[];
            loading: boolean;
            error: string | null;
        }
    }>({});

    const defaultEnabledActions = {
        zoomIn: true,
        zoomOut: true,
        centerHere: true,
        copyCoordinates: true,
        plotCoordinates: true,
        plotMarker: true,
        addText: true,
        streetView: true,
        pictometry: true,
        measureDistance: true,
        measureArea: true,
        whatsHere: true
    };

    const defaultMeasurementSettings = {
        defaultUnits: 'feet' as const,
        unitDisplay: 'single' as const
    };

    const defaultMarkerSettings = {
        markerSize: 8,
        markerColor: '#0078ff',
        markerStyle: 'circle',
        markerOutlineColor: '#ffffff',
        markerOutlineWidth: 1,
        markerOpacity: 1,
        markerAngle: 0,
        markerXOffset: 0,
        markerYOffset: 0,
        customPath: ''
    };

    const defaultPlotSettings = {
        markerSize: 12,
        markerColor: '#ff6b6b',
        textColor: '#ffffff',
        textSize: 10,
        showCoordinateText: true,
        showCoordinateLabels: true,
        coordinateSystem: 'map',
        customWkid: undefined,
        coordinateFormat: 'decimal',
        decimalPlaces: 6,
        labelOffset: 20,
        labelTextSize: 10,
        labelTextColor: '#000000'
    };

    const defaultTextSettings = {
        fontSize: 14,
        fontColor: '#000000',
        fontFamily: 'Arial',
        fontWeight: 'bold',
        haloColor: '#ffffff',
        haloSize: 2,
        backgroundColor: 'transparent',
        backgroundOpacity: 0.8
    };

    const enabledActions = React.useMemo(() =>
        ({ ...defaultEnabledActions, ...config.enabledActions }),
        [config.enabledActions]
    );

    const measurementSettings = React.useMemo(() =>
        ({ ...defaultMeasurementSettings, ...config.measurementSettings }),
        [config.measurementSettings]
    );

    const plotSettings = React.useMemo(() =>
        ({ ...defaultPlotSettings, ...config.plotSettings }),
        [config.plotSettings]
    );

    const markerSettings = React.useMemo(() =>
        ({ ...defaultMarkerSettings, ...config.markerSettings }),
        [config.markerSettings]
    );

    const textSettings = React.useMemo(() =>
        ({ ...defaultTextSettings, ...config.textSettings }),
        [config.textSettings]
    );

    // Helper function to check if measurement actions are enabled
    const isMeasurementEnabled = React.useMemo(() =>
        enabledActions.measureDistance || enabledActions.measureArea,
        [enabledActions.measureDistance, enabledActions.measureArea]
    );

    // Function to fetch fields from Feature Service
    const fetchFieldsFromService = async (url: string, layerIndex: number) => {
        if (!url.trim()) return;

        setFieldStates(prev => ({
            ...prev,
            [layerIndex]: { fields: [], loading: true, error: null }
        }));

        try {
            let serviceUrl = url.trim();
            if (!serviceUrl.includes('?')) {
                serviceUrl += '?f=json';
            } else if (!serviceUrl.includes('f=json')) {
                serviceUrl += '&f=json';
            }

            const response = await fetch(serviceUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || 'Service returned an error');
            }

            if (!data.fields || !Array.isArray(data.fields)) {
                throw new Error('No fields found in service response');
            }

            const serviceFields: ServiceField[] = data.fields.map((field: any) => ({
                name: field.name,
                alias: field.alias || field.name,
                type: field.type
            }));

            setFieldStates(prev => ({
                ...prev,
                [layerIndex]: { fields: serviceFields, loading: false, error: null }
            }));

        } catch (error) {
            console.error('Error fetching fields:', error);
            setFieldStates(prev => ({
                ...prev,
                [layerIndex]: {
                    fields: [],
                    loading: false,
                    error: error.message || 'Failed to fetch fields from service'
                }
            }));
        }
    };

    const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                useMapWidgetIds: Immutable(useMapWidgetIds)
            })
        });
    };

    const updateEnabledAction = (action: string, value: boolean) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                enabledActions: {
                    ...enabledActions,
                    [action]: value
                }
            })
        });
    };

    const updateCoordinateSystem = (value: 'map' | 'webMercator') => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                coordinateSystem: value
            })
        });
    };

    const updateMeasurementSetting = (property: keyof typeof measurementSettings, value: any) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                measurementSettings: {
                    ...measurementSettings,
                    [property]: value
                }
            })
        });
    };

    const updatePlotSetting = (property: keyof typeof plotSettings, value: any) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                plotSettings: {
                    ...plotSettings,
                    [property]: value
                }
            })
        });
    };

    const updateMarkerSetting = (property: keyof typeof markerSettings, value: any) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                markerSettings: {
                    ...markerSettings,
                    [property]: value
                }
            })
        });
    };

    const updateTextSetting = (property: keyof typeof textSettings, value: any) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                textSettings: {
                    ...textSettings,
                    [property]: value
                }
            })
        });
    };

    const updateWhatsHereUrl = (value: string) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                reverseGeocodeUrl: value
            })
        });
    };

    const updateReverseGeocodeWkid = (value: string) => {
        const wkid = parseInt(value, 10);
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                reverseGeocodeWkid: isNaN(wkid) ? undefined : wkid
            })
        });
    };

    const updatePictometryUrl = (value: string) => {
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                pictometryUrl: value
            })
        });
    };

    const updateFeatureLayer = (index: number, layer: FeatureLayerConfig) => {
        const updated = [...(config.featureLayers || [])];
        updated[index] = layer;
        props.onSettingChange({
            id: props.id,
            config: Immutable({ ...config, featureLayers: updated })
        });
    };

    const addFeatureLayer = () => {
        const newLayer: FeatureLayerConfig = {
            name: '',
            url: '',
            fields: []
        };
        const updated = [...(config.featureLayers || []), newLayer];
        props.onSettingChange({
            id: props.id,
            config: Immutable({ ...config, featureLayers: updated })
        });
    };

    const removeFeatureLayer = (index: number) => {
        const updated = [...(config.featureLayers || [])];
        updated.splice(index, 1);
        props.onSettingChange({
            id: props.id,
            config: Immutable({ ...config, featureLayers: updated })
        });

        setFieldStates(prev => {
            const newState = { ...prev };
            delete newState[index];
            return newState;
        });
    };

    const updateWhatsHereSettings = (property: string, value: any) => {
        const whatsHereSettings = config.whatsHereSettings || {};
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                whatsHereSettings: {
                    ...whatsHereSettings,
                    [property]: value
                }
            })
        });
    };

    const updateUISettings = (property: string, value: any) => {
        const uiSettings = config.uiSettings || {};
        props.onSettingChange({
            id: props.id,
            config: Immutable({
                ...config,
                uiSettings: {
                    ...uiSettings,
                    [property]: value
                }
            })
        });
    };

    const updateFieldSelection = (layerIndex: number, fieldName: string, selected: boolean) => {
        const layer = config.featureLayers[layerIndex];
        const currentFields = layer.fields || [];

        let updatedFields;
        if (selected) {
            updatedFields = [...currentFields, fieldName];
        } else {
            updatedFields = currentFields.filter(f => f !== fieldName);
        }

        updateFeatureLayer(layerIndex, {
            ...layer,
            fields: updatedFields
        });
    };

    const toggleAllFields = (layerIndex: number, showAll: boolean) => {
        const layer = config.featureLayers[layerIndex];
        const availableFields = fieldStates[layerIndex]?.fields || [];

        const updatedFields = showAll ? availableFields.map(f => f.name) : [];

        updateFeatureLayer(layerIndex, {
            ...layer,
            fields: updatedFields
        });
    };

    const formatActionName = (key: string): string => {
        const actionNames = {
            zoomIn: 'Zoom In',
            zoomOut: 'Zoom Out',
            centerHere: 'Center Here',
            copyCoordinates: 'Copy Coordinates',
            plotCoordinates: 'Plot Coordinates',
            plotMarker: 'Plot Marker',
            addText: 'Add Text',
            streetView: 'Open in Google Street View',
            pictometry: 'Open in Pictometry',
            measureDistance: 'Measure Distance',
            measureArea: 'Measure Area',
            whatsHere: `What's here?`
        };
        return actionNames[key] || key.replace(/([A-Z])/g, ' $1');
    };

    // IMPROVED STYLES WITH BETTER ORGANIZATION AND CONSISTENCY
    const styles = React.useMemo(() => ({
        // === BASE LAYOUT STYLES ===
        mainContainer: {
            fontSize: '13px',
            lineHeight: '1.4',
            color: 'var(--dark-800)'
        } as React.CSSProperties,

        // === INPUT STYLES ===
        inputContainer: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '100%'
        } as React.CSSProperties,

        inputLabel: {
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--dark-600)',
            lineHeight: '1.3',
            marginBottom: '0'
        } as React.CSSProperties,

        helpText: {
            fontSize: '11px',
            color: 'var(--light-600)',
            lineHeight: '1.3',
            fontStyle: 'italic'
        } as React.CSSProperties,

        disabledText: {
            fontSize: '11px',
            color: 'var(--light-500)',
            lineHeight: '1.3',
            fontStyle: 'italic'
        } as React.CSSProperties,

        // === GRID LAYOUTS ===
        settingsGrid: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            alignItems: 'start'
        } as React.CSSProperties,

        plotSettingsGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            alignItems: 'end'
        } as React.CSSProperties,

        // === RADIO GROUP STYLES ===
        radioGroup: {
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-start'
        } as React.CSSProperties,

        radioLabel: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: 0,
            padding: '4px 0',
            fontSize: '13px',
            color: 'var(--dark-700)',
            cursor: 'pointer',
            lineHeight: '1.3'
        } as React.CSSProperties,

        // === MEASUREMENT SPECIFIC STYLES ===
        measurementContainer: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '20px',
            width: '100%'
        } as React.CSSProperties,

        measurementLabel: {
            minWidth: '100px',
            fontWeight: 600,
            fontSize: '12px',
            paddingTop: '6px',
            flexShrink: 0,
            color: 'var(--dark-600)'
        } as React.CSSProperties,

        measurementRadioGroup: {
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flex: 1,
            alignItems: 'flex-start'
        } as React.CSSProperties,

        // === COLOR PICKER STYLES ===
        colorPicker: {
            width: '40px',
            height: '32px',
            padding: '2px',
            border: '1px solid var(--light-400)',
            borderRadius: '3px',
            cursor: 'pointer'
        } as React.CSSProperties,

        colorInputContainer: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        } as React.CSSProperties,

        // === ALERT/WARNING STYLES ===
        warningBox: {
            padding: '12px 16px',
            backgroundColor: 'var(--warning-100)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--warning-700)',
            border: '1px solid var(--warning-300)',
            lineHeight: '1.4'
        } as React.CSSProperties,

        errorContainer: {
            padding: '10px 12px',
            backgroundColor: 'var(--danger-100)',
            borderRadius: '4px',
            fontSize: '11px',
            color: 'var(--danger-700)',
            border: '1px solid var(--danger-300)',
            lineHeight: '1.4'
        } as React.CSSProperties,

        // === FEATURE LAYER STYLES ===
        featureLayerContainer: {
            border: '1px solid var(--light-400)',
            borderRadius: '6px',
            padding: '0',
            marginBottom: '12px',
            backgroundColor: 'var(--white)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        } as React.CSSProperties,

        featureLayerHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: 'var(--light-200)',
            borderBottom: '1px solid var(--light-400)',
            borderRadius: '5px 5px 0 0'
        } as React.CSSProperties,

        featureLayerTitle: {
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--dark-800)',
            lineHeight: '1.3'
        } as React.CSSProperties,

        featureLayerContent: {
            padding: '16px'
        } as React.CSSProperties,

        removeButton: {
            minWidth: '28px',
            height: '28px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '3px'
        } as React.CSSProperties,

        // === FIELD SELECTION STYLES ===
        fieldSelectionContainer: {
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'var(--light-100)',
            borderRadius: '4px',
            border: '1px solid var(--light-300)'
        } as React.CSSProperties,

        fieldSelectionHeader: {
            fontSize: '11px',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--dark-600)',
            lineHeight: '1.3'
        } as React.CSSProperties,

        fieldCheckboxList: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '180px',
            overflowY: 'auto',
            marginBottom: '12px',
            padding: '4px 0'
        } as React.CSSProperties,

        fieldCheckboxItem: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '4px 0',
            lineHeight: '1.3'
        } as React.CSSProperties,

        fieldTextContainer: {
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            flex: 1,
            minWidth: 0
        } as React.CSSProperties,

        fieldName: {
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--dark-800)',
            lineHeight: '1.3',
            wordBreak: 'break-word'
        } as React.CSSProperties,

        fieldAlias: {
            fontSize: '11px',
            color: 'var(--light-600)',
            fontStyle: 'italic',
            lineHeight: '1.3',
            wordBreak: 'break-word'
        } as React.CSSProperties,

        showAllContainer: {
            borderTop: '1px solid var(--light-300)',
            paddingTop: '12px',
            marginTop: '8px',
            display: 'flex',
            gap: '8px'
        } as React.CSSProperties,

        // === MISC STYLES ===
        loadingContainer: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '20px',
            fontSize: '11px',
            color: 'var(--light-600)',
            lineHeight: '1.3'
        } as React.CSSProperties,

        urlInputContainer: {
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px'
        } as React.CSSProperties,

        refreshButton: {
            marginLeft: '0'
        } as React.CSSProperties,

        addButton: {
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            border: '2px dashed var(--light-500)',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: 'var(--light-600)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '13px',
            fontWeight: 500,
            minHeight: '40px'
        } as React.CSSProperties,

        emptyState: {
            textAlign: 'center',
            padding: '32px 20px',
            color: 'var(--light-600)',
            fontSize: '12px',
            lineHeight: '1.4'
        } as React.CSSProperties,

        fieldRow: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginBottom: '16px'
        } as React.CSSProperties,

        sectionDescription: {
            fontSize: '12px',
            color: 'var(--light-600)',
            lineHeight: '1.4',
            marginBottom: '16px',
            padding: '0'
        } as React.CSSProperties
    }), []);

    const actionEntries = React.useMemo(() => Object.entries(enabledActions), [enabledActions]);
    const unitOptions = React.useMemo(() => ['feet', 'yards', 'miles', 'meters', 'kilometers'], []);

    return (
        <div className="widget-setting-right-click-map" style={styles.mainContainer}>
            <SettingSection title="Map Configuration">
                <SettingRow>
                    <div style={styles.sectionDescription}>
                        Select a map widget to enable right-click functionality
                    </div>
                </SettingRow>
                <SettingRow>
                    <MapWidgetSelector
                        onSelect={onMapWidgetSelected}
                        useMapWidgetIds={Immutable(config.useMapWidgetIds || [])}
                    />
                </SettingRow>
            </SettingSection>

            <SettingSection title="Enable Right-Click Actions">
                {actionEntries.map(([key, value]) => (
                    <SettingRow key={key} label={formatActionName(key)}>
                        <Switch checked={value} onChange={(e) => updateEnabledAction(key, e.target.checked)} />
                    </SettingRow>
                ))}
            </SettingSection>

            {/* Plot Coordinates Settings - Only show if plotCoordinates is enabled */}
            {enabledActions.plotCoordinates && (
                <SettingSection title="Plot Coordinates Settings">
                    <SettingRow>
                        <div style={styles.sectionDescription}>
                            Configure how coordinate markers appear on the map. Markers are numbered sequentially and persist during the browser session.
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Coordinate System for Display</label>
                            <div role="radiogroup" style={styles.radioGroup}>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="plot-coord-system"
                                        value="map"
                                        checked={plotSettings.coordinateSystem === 'map' || !plotSettings.coordinateSystem}
                                        onChange={() => updatePlotSetting('coordinateSystem', 'map')}
                                    />
                                    Use Map's Native Coordinate System
                                </label>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="plot-coord-system"
                                        value="webMercator"
                                        checked={plotSettings.coordinateSystem === 'webMercator'}
                                        onChange={() => updatePlotSetting('coordinateSystem', 'webMercator')}
                                    />
                                    Lat/Lon (WGS84)
                                </label>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="plot-coord-system"
                                        value="custom"
                                        checked={plotSettings.coordinateSystem === 'custom'}
                                        onChange={() => updatePlotSetting('coordinateSystem', 'custom')}
                                    />
                                    Custom Coordinate System
                                </label>
                            </div>
                        </div>
                    </SettingRow>

                    {plotSettings.coordinateSystem === 'custom' && (
                        <SettingRow>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Custom WKID</label>
                                <NumericInput
                                    value={plotSettings.customWkid || ''}
                                    onChange={(value) => updatePlotSetting('customWkid', value)}
                                    placeholder="e.g. 3857, 4326, 2154"
                                    size="sm"
                                />
                                <div style={styles.helpText}>
                                    Enter the WKID (Well-Known ID) for your desired coordinate system
                                </div>
                            </div>
                        </SettingRow>
                    )}

                    {plotSettings.coordinateSystem === 'webMercator' && (
                        <SettingRow>
                            <div style={styles.settingsGrid}>
                                <div style={styles.inputContainer}>
                                    <label style={styles.inputLabel}>Lat/Lon Format</label>
                                    <div role="radiogroup" style={styles.radioGroup}>
                                        <label style={styles.radioLabel}>
                                            <Radio
                                                name="coord-format"
                                                value="decimal"
                                                checked={plotSettings.coordinateFormat === 'decimal' || !plotSettings.coordinateFormat}
                                                onChange={() => updatePlotSetting('coordinateFormat', 'decimal')}
                                            />
                                            Decimal Degrees
                                        </label>
                                        <label style={styles.radioLabel}>
                                            <Radio
                                                name="coord-format"
                                                value="dms"
                                                checked={plotSettings.coordinateFormat === 'dms'}
                                                onChange={() => updatePlotSetting('coordinateFormat', 'dms')}
                                            />
                                            Degrees, Minutes, Seconds
                                        </label>
                                    </div>
                                </div>
                                <div style={styles.inputContainer}>
                                    <label style={styles.inputLabel}>Decimal Places</label>
                                    <NumericInput
                                        value={plotSettings.decimalPlaces || 6}
                                        onChange={(value) => updatePlotSetting('decimalPlaces', value)}
                                        min={0}
                                        max={10}
                                        size="sm"
                                        disabled={plotSettings.coordinateFormat === 'dms'}
                                    />
                                </div>
                            </div>
                        </SettingRow>
                    )}

                    {(plotSettings.coordinateSystem === 'map' || plotSettings.coordinateSystem === 'custom') && (
                        <SettingRow>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Decimal Places</label>
                                <NumericInput
                                    value={plotSettings.decimalPlaces || 2}
                                    onChange={(value) => updatePlotSetting('decimalPlaces', value)}
                                    min={0}
                                    max={10}
                                    size="sm"
                                />
                            </div>
                        </SettingRow>
                    )}

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Marker Style</label>
                            <Select
                                value={plotSettings.markerStyle || 'circle'}
                                onChange={(e) => updatePlotSetting('markerStyle', e.target.value)}
                                size="sm"
                            >
                                <Option value="circle">Circle</Option>
                                <Option value="square">Square</Option>
                                <Option value="cross">Cross</Option>
                                <Option value="x">X</Option>
                                <Option value="diamond">Diamond</Option>
                                <Option value="triangle">Triangle</Option>
                                <Option value="pin">Pin</Option>
                            </Select>
                            <div style={styles.helpText}>
                                Choose the shape style for your marker symbol
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.plotSettingsGrid}>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Marker Size</label>
                                <NumericInput
                                    value={plotSettings.markerSize}
                                    onChange={(value) => updatePlotSetting('markerSize', value)}
                                    min={8}
                                    max={24}
                                    size="sm"
                                />
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Text Size</label>
                                <NumericInput
                                    value={plotSettings.textSize}
                                    onChange={(value) => updatePlotSetting('textSize', value)}
                                    min={6}
                                    max={16}
                                    size="sm"
                                />
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Show Coordinate Labels</label>
                                <Switch
                                    checked={plotSettings.showCoordinateLabels}
                                    onChange={(e) => updatePlotSetting('showCoordinateLabels', e.target.checked)}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    {plotSettings.showCoordinateLabels && (
                        <SettingRow>
                            <div style={styles.settingsGrid}>
                                <div style={styles.inputContainer}>
                                    <label style={styles.inputLabel}>Label Offset (pixels)</label>
                                    <NumericInput
                                        value={plotSettings.labelOffset || 20}
                                        onChange={(value) => updatePlotSetting('labelOffset', value)}
                                        min={5}
                                        max={100}
                                        size="sm"
                                    />
                                    <div style={styles.helpText}>
                                        Distance from marker to coordinate label
                                    </div>
                                </div>
                                <div style={styles.inputContainer}>
                                    <label style={styles.inputLabel}>Label Text Size</label>
                                    <NumericInput
                                        value={plotSettings.labelTextSize || 10}
                                        onChange={(value) => updatePlotSetting('labelTextSize', value)}
                                        min={6}
                                        max={16}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </SettingRow>
                    )}

                    <SettingRow>
                        <div style={styles.plotSettingsGrid}>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Show Coordinates in Popup</label>
                                <Switch
                                    checked={plotSettings.showCoordinateText}
                                    onChange={(e) => updatePlotSetting('showCoordinateText', e.target.checked)}
                                />
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Marker Color</label>
                                <div style={styles.colorInputContainer}>
                                    <input
                                        type="color"
                                        value={plotSettings.markerColor}
                                        onChange={(e) => updatePlotSetting('markerColor', e.target.value)}
                                        style={styles.colorPicker}
                                    />
                                    <TextInput
                                        value={plotSettings.markerColor}
                                        onChange={(e) => updatePlotSetting('markerColor', e.target.value)}
                                        placeholder="#ff6b6b"
                                        size="sm"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Text Color</label>
                                <div style={styles.colorInputContainer}>
                                    <input
                                        type="color"
                                        value={plotSettings.textColor}
                                        onChange={(e) => updatePlotSetting('textColor', e.target.value)}
                                        style={styles.colorPicker}
                                    />
                                    <TextInput
                                        value={plotSettings.textColor}
                                        onChange={(e) => updatePlotSetting('textColor', e.target.value)}
                                        placeholder="#ffffff"
                                        size="sm"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Outline Color</label>
                            <div style={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={plotSettings.markerOutlineColor || '#ffffff'}
                                    onChange={(e) => updatePlotSetting('markerOutlineColor', e.target.value)}
                                    style={styles.colorPicker}
                                />
                                <TextInput
                                    value={plotSettings.markerOutlineColor || '#ffffff'}
                                    onChange={(e) => updatePlotSetting('markerOutlineColor', e.target.value)}
                                    placeholder="#ffffff"
                                    size="sm"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Outline Width</label>
                            <NumericInput
                                value={plotSettings.markerOutlineWidth || 1}
                                onChange={(value) => updatePlotSetting('markerOutlineWidth', value)}
                                min={0}
                                max={8}
                                size="sm"
                            />
                            <div style={styles.helpText}>Thickness in pixels</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Rotation Angle</label>
                            <NumericInput
                                value={plotSettings.markerAngle || 0}
                                onChange={(value) => updatePlotSetting('markerAngle', value)}
                                min={0}
                                max={360}
                                size="sm"
                                style={{ maxWidth: '150px' }}
                            />
                            <div style={styles.helpText}>
                                Rotation angle in degrees (0-360)
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>X Offset</label>
                            <NumericInput
                                value={plotSettings.markerXOffset || 0}
                                onChange={(value) => updatePlotSetting('markerXOffset', value)}
                                min={-50}
                                max={50}
                                size="sm"
                            />
                            <div style={styles.helpText}>Horizontal offset in pixels</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Y Offset</label>
                            <NumericInput
                                value={plotSettings.markerYOffset || 0}
                                onChange={(value) => updatePlotSetting('markerYOffset', value)}
                                min={-50}
                                max={50}
                                size="sm"
                            />
                            <div style={styles.helpText}>Vertical offset in pixels</div>
                        </div>
                    </SettingRow>

                    {plotSettings.showCoordinateLabels && (
                        <SettingRow>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Label Text Color</label>
                                <div style={styles.colorInputContainer}>
                                    <input
                                        type="color"
                                        value={plotSettings.labelTextColor || '#000000'}
                                        onChange={(e) => updatePlotSetting('labelTextColor', e.target.value)}
                                        style={styles.colorPicker}
                                    />
                                    <TextInput
                                        value={plotSettings.labelTextColor || '#000000'}
                                        onChange={(e) => updatePlotSetting('labelTextColor', e.target.value)}
                                        placeholder="#000000"
                                        size="sm"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </div>
                        </SettingRow>
                    )}

                    <SettingRow>
                        <div style={{
                            ...styles.fieldSelectionContainer,
                            textAlign: 'center',
                            marginTop: '16px'
                        }}>
                            <div style={styles.fieldSelectionHeader}>
                                Marker Preview
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                padding: '20px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '4px',
                                border: '1px solid var(--light-300)',
                                minHeight: '80px'
                            }}>
                                {/* Preview will be rendered based on current settings */}
                                <div style={{
                                    width: `${plotSettings.markerSize}px`,
                                    height: `${plotSettings.markerSize}px`,
                                    backgroundColor: plotSettings.markerColor,
                                    border: `${plotSettings.markerOutlineWidth || 1}px solid ${plotSettings.markerOutlineColor || '#ffffff'}`,
                                    opacity: plotSettings.markerOpacity || 1,
                                    transform: `rotate(${plotSettings.markerAngle || 0}deg) translate(${plotSettings.markerXOffset || 0}px, ${plotSettings.markerYOffset || 0}px)`,
                                    borderRadius: (plotSettings.markerStyle || 'circle') === 'circle' ? '50%' :
                                        (plotSettings.markerStyle || 'circle') === 'diamond' ? '0' :
                                            (plotSettings.markerStyle || 'circle') === 'triangle' ? '0' :
                                                (plotSettings.markerStyle || 'circle') === 'pin' ? '50% 50% 50% 0' : '0',
                                    clipPath: (plotSettings.markerStyle || 'circle') === 'diamond' ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' :
                                        (plotSettings.markerStyle || 'circle') === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' :
                                            (plotSettings.markerStyle || 'circle') === 'cross' ? 'polygon(40% 0%, 60% 0%, 60% 40%, 100% 40%, 100% 60%, 60% 60%, 60% 100%, 40% 100%, 40% 60%, 0% 60%, 0% 40%, 40% 40%)' :
                                                (plotSettings.markerStyle || 'circle') === 'x' ? 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)' :
                                                    (plotSettings.markerStyle || 'circle') === 'pin' ? 'circle(40% at 50% 40%)' :
                                                        'none'
                                }} />
                                <div style={{
                                    marginLeft: '12px',
                                    fontSize: '11px',
                                    color: 'var(--light-600)',
                                    textAlign: 'left'
                                }}>
                                    <div>Size: {plotSettings.markerSize}px</div>
                                    <div>Style: {plotSettings.markerStyle || 'circle'}</div>
                                    <div>Outline: {plotSettings.markerOutlineWidth || 1}px</div>
                                    {(plotSettings.markerAngle || 0) !== 0 && <div>Rotation: {plotSettings.markerAngle}°</div>}
                                    {((plotSettings.markerXOffset || 0) !== 0 || (plotSettings.markerYOffset || 0) !== 0) &&
                                        <div>Offset: {plotSettings.markerXOffset || 0}, {plotSettings.markerYOffset || 0}</div>
                                    }
                                </div>
                            </div>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Simple Marker Settings - Only show if plotMarker is enabled */}
            {enabledActions.plotMarker && (
                <SettingSection title="Simple Marker Settings">
                    <SettingRow>
                        <div style={styles.sectionDescription}>
                            Configure simple markers with various styles and customization options.
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Marker Style</label>
                            <Select
                                value={markerSettings.markerStyle || 'circle'}
                                onChange={(e) => updateMarkerSetting('markerStyle', e.target.value)}
                                size="sm"
                            >
                                <Option value="circle">Circle</Option>
                                <Option value="square">Square</Option>
                                <Option value="cross">Cross</Option>
                                <Option value="x">X</Option>
                                <Option value="diamond">Diamond</Option>
                                <Option value="triangle">Triangle</Option>
                                <Option value="pin">Pin</Option>
                            </Select>
                            <div style={styles.helpText}>
                                Choose the shape style for your marker symbol
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Marker Size</label>
                            <NumericInput
                                value={markerSettings.markerSize}
                                onChange={(value) => updateMarkerSetting('markerSize', value)}
                                min={4}
                                max={48}
                                size="sm"
                            />
                            <div style={styles.helpText}>Size in pixels</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Opacity</label>
                            <NumericInput
                                value={markerSettings.markerOpacity || 1}
                                onChange={(value) => updateMarkerSetting('markerOpacity', value)}
                                min={0}
                                max={1}
                                step={0.1}
                                size="sm"
                            />
                            <div style={styles.helpText}>0.0 to 1.0 transparency</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Marker Color</label>
                            <div style={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={markerSettings.markerColor}
                                    onChange={(e) => updateMarkerSetting('markerColor', e.target.value)}
                                    style={styles.colorPicker}
                                />
                                <TextInput
                                    value={markerSettings.markerColor}
                                    onChange={(e) => updateMarkerSetting('markerColor', e.target.value)}
                                    placeholder="#0078ff"
                                    size="sm"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Outline Color</label>
                            <div style={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={markerSettings.markerOutlineColor || '#ffffff'}
                                    onChange={(e) => updateMarkerSetting('markerOutlineColor', e.target.value)}
                                    style={styles.colorPicker}
                                />
                                <TextInput
                                    value={markerSettings.markerOutlineColor || '#ffffff'}
                                    onChange={(e) => updateMarkerSetting('markerOutlineColor', e.target.value)}
                                    placeholder="#ffffff"
                                    size="sm"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Outline Width</label>
                            <NumericInput
                                value={markerSettings.markerOutlineWidth || 1}
                                onChange={(value) => updateMarkerSetting('markerOutlineWidth', value)}
                                min={0}
                                max={8}
                                size="sm"
                            />
                            <div style={styles.helpText}>Thickness in pixels</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Rotation Angle</label>
                            <NumericInput
                                value={markerSettings.markerAngle || 0}
                                onChange={(value) => updateMarkerSetting('markerAngle', value)}
                                min={0}
                                max={360}
                                size="sm"
                                style={{ maxWidth: '150px' }}
                            />
                            <div style={styles.helpText}>
                                Rotation angle in degrees (0-360)
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>X Offset</label>
                            <NumericInput
                                value={markerSettings.markerXOffset || 0}
                                onChange={(value) => updateMarkerSetting('markerXOffset', value)}
                                min={-50}
                                max={50}
                                size="sm"
                            />
                            <div style={styles.helpText}>Horizontal offset in pixels</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Y Offset</label>
                            <NumericInput
                                value={markerSettings.markerYOffset || 0}
                                onChange={(value) => updateMarkerSetting('markerYOffset', value)}
                                min={-50}
                                max={50}
                                size="sm"
                            />
                            <div style={styles.helpText}>Vertical offset in pixels</div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={{
                            ...styles.fieldSelectionContainer,
                            textAlign: 'center',
                            marginTop: '16px'
                        }}>
                            <div style={styles.fieldSelectionHeader}>
                                Marker Preview
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                padding: '20px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '4px',
                                border: '1px solid var(--light-300)',
                                minHeight: '80px'
                            }}>
                                {/* Preview will be rendered based on current settings */}
                                <div style={{
                                    width: `${markerSettings.markerSize}px`,
                                    height: `${markerSettings.markerSize}px`,
                                    backgroundColor: markerSettings.markerColor,
                                    border: `${markerSettings.markerOutlineWidth || 1}px solid ${markerSettings.markerOutlineColor || '#ffffff'}`,
                                    opacity: markerSettings.markerOpacity || 1,
                                    transform: `rotate(${markerSettings.markerAngle || 0}deg) translate(${markerSettings.markerXOffset || 0}px, ${markerSettings.markerYOffset || 0}px)`,
                                    borderRadius: markerSettings.markerStyle === 'circle' ? '50%' :
                                        markerSettings.markerStyle === 'diamond' ? '0' :
                                            markerSettings.markerStyle === 'triangle' ? '0' :
                                                markerSettings.markerStyle === 'pin' ? '50% 50% 50% 0' : '0',
                                    clipPath: markerSettings.markerStyle === 'diamond' ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' :
                                        markerSettings.markerStyle === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' :
                                            markerSettings.markerStyle === 'cross' ? 'polygon(40% 0%, 60% 0%, 60% 40%, 100% 40%, 100% 60%, 60% 60%, 60% 100%, 40% 100%, 40% 60%, 0% 60%, 0% 40%, 40% 40%)' :
                                                markerSettings.markerStyle === 'x' ? 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)' :
                                                    markerSettings.markerStyle === 'pin' ? 'circle(40% at 50% 40%)' :
                                                        'none'
                                }} />
                                <div style={{
                                    marginLeft: '12px',
                                    fontSize: '11px',
                                    color: 'var(--light-600)',
                                    textAlign: 'left'
                                }}>
                                    <div>Size: {markerSettings.markerSize}px</div>
                                    <div>Style: {markerSettings.markerStyle || 'circle'}</div>
                                    <div>Opacity: {markerSettings.markerOpacity || 1}</div>
                                    {(markerSettings.markerAngle || 0) !== 0 && <div>Rotation: {markerSettings.markerAngle}°</div>}
                                </div>
                            </div>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Text Settings - Only show if addText is enabled */}
            {enabledActions.addText && (
                <SettingSection title="Text Settings">
                    <SettingRow>
                        <div style={styles.sectionDescription}>
                            Configure how text appears when added to the map. Text graphics persist during the browser session.
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.settingsGrid}>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Font Size</label>
                                <NumericInput
                                    value={textSettings.fontSize}
                                    onChange={(value) => updateTextSetting('fontSize', value)}
                                    min={8}
                                    max={48}
                                    size="sm"
                                />
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Font Family</label>
                                <Select
                                    value={textSettings.fontFamily || 'Arial'}
                                    onChange={(e) => updateTextSetting('fontFamily', e.target.value)}
                                    size="sm"
                                >
                                    <Option value="Arial">Arial</Option>
                                    <Option value="Helvetica">Helvetica</Option>
                                    <Option value="Times New Roman">Times New Roman</Option>
                                    <Option value="Courier New">Courier New</Option>
                                    <Option value="Georgia">Georgia</Option>
                                    <Option value="Verdana">Verdana</Option>
                                    <Option value="Tahoma">Tahoma</Option>
                                    <Option value="Trebuchet MS">Trebuchet MS</Option>
                                </Select>
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Font Weight</label>
                            <div role="radiogroup" style={styles.radioGroup}>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="font-weight"
                                        value="normal"
                                        checked={textSettings.fontWeight === 'normal'}
                                        onChange={() => updateTextSetting('fontWeight', 'normal')}
                                    />
                                    Normal
                                </label>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="font-weight"
                                        value="bold"
                                        checked={textSettings.fontWeight === 'bold' || !textSettings.fontWeight}
                                        onChange={() => updateTextSetting('fontWeight', 'bold')}
                                    />
                                    Bold
                                </label>
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Text Color</label>
                            <div style={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={textSettings.fontColor}
                                    onChange={(e) => updateTextSetting('fontColor', e.target.value)}
                                    style={styles.colorPicker}
                                />
                                <TextInput
                                    value={textSettings.fontColor}
                                    onChange={(e) => updateTextSetting('fontColor', e.target.value)}
                                    placeholder="#000000"
                                    size="sm"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Outline Color</label>
                            <div style={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={textSettings.haloColor}
                                    onChange={(e) => updateTextSetting('haloColor', e.target.value)}
                                    style={styles.colorPicker}
                                />
                                <TextInput
                                    value={textSettings.haloColor}
                                    onChange={(e) => updateTextSetting('haloColor', e.target.value)}
                                    placeholder="#ffffff"
                                    size="sm"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Outline Size</label>
                            <NumericInput
                                value={textSettings.haloSize}
                                onChange={(value) => updateTextSetting('haloSize', value)}
                                min={0}
                                max={6}
                                size="sm"
                                style={{ maxWidth: '120px' }}
                            />
                            <div style={styles.helpText}>
                                Set to 0 to disable text outline
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Background Color (optional)</label>
                            <div style={styles.colorInputContainer}>
                                <input
                                    type="color"
                                    value={textSettings.backgroundColor === 'transparent' ? '#ffffff' : textSettings.backgroundColor}
                                    onChange={(e) => updateTextSetting('backgroundColor', e.target.value)}
                                    style={styles.colorPicker}
                                />
                                <TextInput
                                    value={textSettings.backgroundColor}
                                    onChange={(e) => updateTextSetting('backgroundColor', e.target.value)}
                                    placeholder="transparent"
                                    size="sm"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <Button
                                type="tertiary"
                                size="sm"
                                onClick={() => updateTextSetting('backgroundColor', 'transparent')}
                                style={{ alignSelf: 'flex-start' }}
                            >
                                Clear Background
                            </Button>
                            <div style={styles.helpText}>
                                Set to "transparent" for no background, or choose a color for text with background
                            </div>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Pictometry Settings - Only show if pictometry is enabled */}
            {enabledActions.pictometry && (
                <SettingSection title="Pictometry Settings">
                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Pictometry URL</label>
                            <TextInput
                                style={{ width: '100%' }}
                                value={config.pictometryUrl || ''}
                                onChange={(e) => updatePictometryUrl(e.target.value)}
                                placeholder="https://example.com/gjPictViz.aspx"
                            />
                        </div>
                    </SettingRow>
                    {!config.pictometryUrl && (
                        <SettingRow>
                            <div style={styles.warningBox}>
                                <strong>Warning:</strong> Pictometry is enabled but no URL is configured. The right-click option will not work without a valid URL.
                            </div>
                        </SettingRow>
                    )}
                </SettingSection>
            )}

            {/* What's Here Service - Only show if whatsHere is enabled */}
            {enabledActions.whatsHere && (
                <SettingSection title="What's Here? Service">
                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Geocoding Service URL</label>
                            <TextInput
                                style={{ width: '100%' }}
                                value={config.reverseGeocodeUrl || ''}
                                onChange={(e) => updateWhatsHereUrl(e.target.value)}
                                placeholder="https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
                            />
                        </div>
                    </SettingRow>
                    <SettingRow>
                        <div style={styles.inputContainer}>
                            <label style={styles.inputLabel}>Locator WKID</label>
                            <TextInput
                                style={{ width: '100%' }}
                                value={config.reverseGeocodeWkid?.toString() || ''}
                                onChange={(e) => updateReverseGeocodeWkid(e.target.value)}
                                placeholder="e.g. 3857"
                            />
                        </div>
                    </SettingRow>

                    <SettingRow>
                        <div style={styles.settingsGrid}>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Max Results Per Layer</label>
                                <NumericInput
                                    value={config.whatsHereSettings?.maxResults || 10}
                                    onChange={(value) => updateWhatsHereSettings('maxResults', value)}
                                    min={1}
                                    max={50}
                                    size="sm"
                                />
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Search Radius (meters)</label>
                                <NumericInput
                                    value={config.whatsHereSettings?.searchRadius || 10}
                                    onChange={(value) => updateWhatsHereSettings('searchRadius', value)}
                                    min={1}
                                    max={1000}
                                    size="sm"
                                />
                            </div>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Feature Layers - Only show if whatsHere is enabled */}
            {enabledActions.whatsHere && (
                <SettingSection title="Feature Layers for What's Here?">
                    {(!config.featureLayers || config.featureLayers.length === 0) ? (
                        <SettingRow>
                            <div style={styles.emptyState}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                                    <Icon icon="widget-table" size={24} />
                                </div>
                                <div><strong>No feature layers configured</strong></div>
                                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                    Add feature layers to enhance the "What's Here?" functionality
                                </div>
                            </div>
                        </SettingRow>
                    ) : (
                        config.featureLayers.map((layer, index) => {
                            const layerFieldState = fieldStates[index];
                            const hasUrl = layer.url && layer.url.trim().length > 0;

                            const selectedFields = layer.fields || [];
                            const availableFields = layerFieldState?.fields || [];

                            return (
                                <SettingRow key={index}>
                                    <div style={styles.featureLayerContainer}>
                                        <div style={styles.featureLayerHeader}>
                                            <div style={styles.featureLayerTitle}>
                                                {layer.name || `Feature Layer ${index + 1}`}
                                            </div>
                                            <Button
                                                type="tertiary"
                                                size="sm"
                                                icon
                                                onClick={() => removeFeatureLayer(index)}
                                                style={styles.removeButton}
                                            >
                                                <TrashOutlined />
                                            </Button>
                                        </div>

                                        <div style={styles.featureLayerContent}>
                                            <div style={styles.fieldRow}>
                                                <label style={styles.inputLabel}>Layer Name</label>
                                                <TextInput
                                                    value={layer.name || ''}
                                                    onChange={(e) =>
                                                        updateFeatureLayer(index, {
                                                            ...layer,
                                                            name: e.target.value
                                                        })
                                                    }
                                                    placeholder="Display name for this layer"
                                                    size="sm"
                                                />
                                            </div>

                                            <div style={styles.fieldRow}>
                                                <label style={styles.inputLabel}>Feature Service URL</label>
                                                <div style={styles.urlInputContainer}>
                                                    <TextInput
                                                        style={{ flex: 1 }}
                                                        value={layer.url || ''}
                                                        onChange={(e) => {
                                                            const newUrl = e.target.value;
                                                            updateFeatureLayer(index, {
                                                                ...layer,
                                                                url: newUrl,
                                                                fields: []
                                                            });

                                                            if (layerFieldState) {
                                                                setFieldStates(prev => ({
                                                                    ...prev,
                                                                    [index]: { fields: [], loading: false, error: null }
                                                                }));
                                                            }
                                                        }}
                                                        placeholder="https://services.arcgis.com/.../FeatureServer/0"
                                                        size="sm"
                                                    />
                                                    {hasUrl && (
                                                        <Tooltip title="Load fields from service">
                                                            <Button
                                                                type="tertiary"
                                                                size="sm"
                                                                icon
                                                                onClick={() => fetchFieldsFromService(layer.url, index)}
                                                                disabled={layerFieldState?.loading}
                                                                style={styles.refreshButton}
                                                            >
                                                                <RefreshOutlined />
                                                            </Button>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={styles.fieldRow}>
                                                <label style={{ ...styles.inputLabel, color: hasUrl ? styles.inputLabel.color : 'var(--light-500)' }}>
                                                    Fields to Display
                                                </label>

                                                {!hasUrl && (
                                                    <div style={styles.disabledText}>
                                                        Enter a Feature Service URL above to load available fields
                                                    </div>
                                                )}

                                                {hasUrl && !layerFieldState && (
                                                    <div style={styles.helpText}>
                                                        Click the refresh button to load fields from the service
                                                    </div>
                                                )}

                                                {layerFieldState?.loading && (
                                                    <div style={styles.loadingContainer}>
                                                        <Loading size="sm" />
                                                        Loading fields from service...
                                                    </div>
                                                )}

                                                {layerFieldState?.error && (
                                                    <div style={styles.errorContainer}>
                                                        <strong>Error:</strong> {layerFieldState.error}
                                                    </div>
                                                )}

                                                {availableFields.length > 0 && (
                                                    <div style={styles.fieldSelectionContainer}>
                                                        <div style={styles.fieldSelectionHeader}>
                                                            Select fields to display ({selectedFields.length} of {availableFields.length} selected):
                                                        </div>

                                                        <div style={styles.fieldCheckboxList}>
                                                            {availableFields.map((field) => (
                                                                <div key={field.name} style={styles.fieldCheckboxItem}>
                                                                    <Checkbox
                                                                        checked={selectedFields.includes(field.name)}
                                                                        onChange={(e) => updateFieldSelection(index, field.name, e.target.checked)}
                                                                    />
                                                                    <div style={styles.fieldTextContainer}>
                                                                        <div style={styles.fieldName}>{field.name}</div>
                                                                        {field.alias !== field.name && (
                                                                            <div style={styles.fieldAlias}>{field.alias}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div style={styles.showAllContainer}>
                                                            <Button
                                                                type="tertiary"
                                                                size="sm"
                                                                onClick={() => toggleAllFields(index, true)}
                                                                disabled={selectedFields.length === availableFields.length}
                                                            >
                                                                Select All
                                                            </Button>
                                                            <Button
                                                                type="tertiary"
                                                                size="sm"
                                                                onClick={() => toggleAllFields(index, false)}
                                                                disabled={selectedFields.length === 0}
                                                            >
                                                                Clear All
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </SettingRow>
                            );
                        })
                    )}

                    <SettingRow flow="wrap">
                        <Button
                            type="primary"
                            size="sm"
                            icon
                            onClick={addFeatureLayer}
                        >
                            <PlusOutlined />
                            Add Feature Layer
                        </Button>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Popup Display Settings - Only show if whatsHere is enabled */}
            {enabledActions.whatsHere && (
                <SettingSection title="Popup Display Settings">
                    <SettingRow>
                        <div style={styles.settingsGrid}>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Popup Max Height (px)</label>
                                <NumericInput
                                    value={config.uiSettings?.popupMaxHeight || 400}
                                    onChange={(value) => updateUISettings('popupMaxHeight', value)}
                                    min={200}
                                    max={800}
                                    size="sm"
                                />
                            </div>
                            <div style={styles.inputContainer}>
                                <label style={styles.inputLabel}>Popup Width (px)</label>
                                <NumericInput
                                    value={config.uiSettings?.popupWidth || 300}
                                    onChange={(value) => updateUISettings('popupWidth', value)}
                                    min={250}
                                    max={500}
                                    size="sm"
                                />
                            </div>
                        </div>
                    </SettingRow>
                    <SettingRow>
                        <div style={styles.radioGroup}>
                            <label style={styles.radioLabel}>
                                <Switch
                                    checked={config.uiSettings?.showLayerNames !== false}
                                    onChange={(e) => updateUISettings('showLayerNames', e.target.checked)}
                                />
                                Show layer names in popup
                            </label>
                            <label style={styles.radioLabel}>
                                <Switch
                                    checked={config.uiSettings?.groupByLayer !== false}
                                    onChange={(e) => updateUISettings('groupByLayer', e.target.checked)}
                                />
                                Group results by layer
                            </label>
                            <label style={styles.radioLabel}>
                                <Switch
                                    checked={config.uiSettings?.showFieldAliases !== false}
                                    onChange={(e) => updateUISettings('showFieldAliases', e.target.checked)}
                                />
                                Use field aliases for display
                            </label>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Coordinate System - Only show if copyCoordinates is enabled */}
            {enabledActions.copyCoordinates && (
                <SettingSection title="Coordinate System for Copy Coordinates">
                    <SettingRow>
                        <div role="radiogroup" style={styles.radioGroup}>
                            <label style={styles.radioLabel}>
                                <Radio
                                    name="coord-system"
                                    value="map"
                                    checked={config.coordinateSystem === 'map' || !config.coordinateSystem}
                                    onChange={() => updateCoordinateSystem('map')}
                                />
                                Use Map's Coordinate System
                            </label>
                            <label style={styles.radioLabel}>
                                <Radio
                                    name="coord-system"
                                    value="webMercator"
                                    checked={config.coordinateSystem === 'webMercator'}
                                    onChange={() => updateCoordinateSystem('webMercator')}
                                />
                                Lat/Lon for Google Maps (WGS84)
                            </label>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}

            {/* Measurement Settings - Only show if measurement actions are enabled */}
            {isMeasurementEnabled && (
                <SettingSection title="Measurement Settings">
                    <SettingRow>
                        <div style={styles.sectionDescription}>
                            Configure measurement units and display options.
                        </div>
                    </SettingRow>
                    <SettingRow>
                        <div style={styles.measurementContainer}>
                            <div style={styles.measurementLabel}>Default Units:</div>
                            <div role="radiogroup" style={styles.measurementRadioGroup}>
                                {unitOptions.map(unit => (
                                    <label key={unit} style={styles.radioLabel}>
                                        <Radio
                                            name="default-units"
                                            value={unit}
                                            checked={measurementSettings.defaultUnits === unit}
                                            onChange={() => updateMeasurementSetting('defaultUnits', unit)}
                                        />
                                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </SettingRow>
                    <SettingRow style={{ marginTop: '20px' }}>
                        <div style={styles.measurementContainer}>
                            <div style={styles.measurementLabel}>Unit Display:</div>

                            <div role="radiogroup" style={styles.measurementRadioGroup}>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="unit-display"
                                        value="single"
                                        checked={measurementSettings.unitDisplay === 'single' || !measurementSettings.unitDisplay}
                                        onChange={() => updateMeasurementSetting('unitDisplay', 'single')}
                                    />
                                    Single Unit Only
                                </label>
                                <label style={styles.radioLabel}>
                                    <Radio
                                        name="unit-display"
                                        value="both"
                                        checked={measurementSettings.unitDisplay === 'both'}
                                        onChange={() => updateMeasurementSetting('unitDisplay', 'both')}
                                    />
                                    Show Both Units
                                </label>
                            </div>
                        </div>
                    </SettingRow>
                </SettingSection>
            )}
        </div>
    );
};

export default Setting;