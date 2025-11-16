export interface FeatureLayerConfig {
    name: string;
    url: string;
    fields: string[];
    // Enhanced data source integration
    dataSourceId?: string;           // Experience Builder data source ID
    layerId?: string;               // Specific layer ID within the data source
    useDataSource?: boolean;        // Whether to use data source or manual URL
    displayFields?: string[];       // Specific fields to display (vs query fields)
    aliasFields?: Record<string, string>; // Field name aliases for display
}

export interface IMConfig {
    useMapWidgetIds: string[];
    coordinateSystem?: 'map' | 'webMercator';
    enabledActions?: {
        zoomIn?: boolean;
        zoomOut?: boolean;
        centerHere?: boolean;
        copyCoordinates?: boolean;
        plotCoordinates?: boolean;      // NEW: Plot coordinate markers
        plotMarker?: boolean;           // NEW: Plot simple markers
        addText?: boolean;              // NEW: Add text functionality
        streetView?: boolean;
        pictometry?: boolean;
        measureDistance?: boolean;
        measureArea?: boolean;
        whatsHere?: boolean;
    };
    measurementSettings?: {
        defaultUnits: 'feet' | 'meters' | 'miles' | 'kilometers' | 'yards';
        unitDisplay: 'single' | 'both';
    };
    reverseGeocodeUrl?: string;
    reverseGeocodeWkid?: number;
    pictometryUrl?: string;
    featureLayers?: FeatureLayerConfig[];

    // Enhanced configuration options
    whatsHereSettings?: {
        maxResults?: number;            // Max features per layer
        searchRadius?: number;          // Search radius in map units
        includeGeometry?: boolean;      // Whether to include geometry in queries
        spatialRelationship?: 'intersects' | 'contains' | 'within';
        orderBy?: string;              // Field to order results by
    };

    // UI customization
    uiSettings?: {
        popupWidth?: number;
        popupMaxHeight?: number;
        showLayerNames?: boolean;       // Whether to show layer names in popup
        groupByLayer?: boolean;         // Group results by layer
        showFieldAliases?: boolean;     // Use field aliases instead of field names
    };

    // UPDATED: Enhanced plot coordinates settings
    plotSettings?: {
        markerSize?: number;           // Size of coordinate markers
        markerColor?: string;          // Color of coordinate markers
        markerStyle?: string;          // NEW: Style of coordinate markers (circle, square, etc.)
        markerOutlineColor?: string;   // NEW: Outline color of coordinate markers
        markerOutlineWidth?: number;   // NEW: Outline width of coordinate markers
        markerAngle?: number;          // NEW: Rotation angle of coordinate markers
        markerXOffset?: number;        // NEW: Horizontal offset of coordinate markers
        markerYOffset?: number;        // NEW: Vertical offset of coordinate markers
        markerOpacity?: number;        // NEW: Opacity of coordinate markers
        textColor?: string;            // Color of coordinate text
        textSize?: number;             // Size of coordinate text
        showCoordinateText?: boolean;  // Whether to show coordinates in popup
        showCoordinateLabels?: boolean; // Whether to show coordinate labels on map
        coordinateSystem?: 'map' | 'webMercator' | 'custom'; // Coordinate system for display
        customWkid?: number;           // Custom WKID for coordinate display
        coordinateFormat?: 'decimal' | 'dms';  // Format for lat/lon display
        decimalPlaces?: number;        // Number of decimal places
        labelOffset?: number;          // Offset distance for coordinate labels
        labelTextSize?: number;        // Size of coordinate label text
        labelTextColor?: string;       // Color of coordinate label text
    };

    // UPDATED: Enhanced marker settings for simple markers
    markerSettings?: {
        markerSize?: number;           // Size of simple markers
        markerColor?: string;          // Color of simple markers
        markerStyle?: string;          // NEW: Style of simple markers (circle, square, etc.)
        markerOutlineColor?: string;   // NEW: Outline color of simple markers
        markerOutlineWidth?: number;   // NEW: Outline width of simple markers
        markerOpacity?: number;        // NEW: Opacity of simple markers
        markerAngle?: number;          // NEW: Rotation angle of simple markers
        markerXOffset?: number;        // NEW: Horizontal offset of simple markers
        markerYOffset?: number;        // NEW: Vertical offset of simple markers
        customPath?: string;           // NEW: Custom SVG path for advanced markers
    };

    // NEW: Text settings configuration
    textSettings?: {
        fontSize?: number;             // Size of text
        fontColor?: string;            // Color of text
        fontFamily?: string;           // Font family
        fontWeight?: 'normal' | 'bold'; // Font weight
        haloColor?: string;            // Text outline color
        haloSize?: number;             // Text outline size
        backgroundColor?: string;       // Optional background color
        backgroundOpacity?: number;     // Background opacity (0-1)
    };
}

// Additional interfaces for data source integration
export interface DataSourceConfig {
    id: string;
    label: string;
    type: 'FEATURE_LAYER' | 'MAP_SERVICE';
    url?: string;
    layerId?: number;
    fields?: FieldConfig[];
}

export interface FieldConfig {
    name: string;
    alias: string;
    type: 'esriFieldTypeString' | 'esriFieldTypeInteger' | 'esriFieldTypeDouble' | 'esriFieldTypeDate';
    visible: boolean;
    editable: boolean;
}

// NEW: Interface for simple markers
export interface SimpleMarker {
    id: string;
    point: __esri.Point;
    graphic: __esri.Graphic;
}

// NEW: Interface for coordinate markers
export interface CoordinateMarker {
    id: string;
    number: number;
    point: __esri.Point;
    graphic: __esri.Graphic;
    coordinateText: string;
}

// NEW: Interface for text graphics
export interface TextGraphic {
    id: string;
    point: __esri.Point;
    graphic: __esri.Graphic;
    text: string;
}

// Configuration validation helpers
export const validateFeatureLayerConfig = (config: FeatureLayerConfig): string[] => {
    const errors: string[] = [];

    if (!config.name?.trim()) {
        errors.push('Layer name is required');
    }

    if (config.useDataSource) {
        if (!config.dataSourceId) {
            errors.push('Data source must be selected when using data source mode');
        }
    } else {
        if (!config.url?.trim()) {
            errors.push('Feature service URL is required when using manual mode');
        } else if (!isValidFeatureServiceUrl(config.url)) {
            errors.push('Invalid feature service URL format');
        }
    }

    return errors;
};

export const isValidFeatureServiceUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname.includes('/FeatureServer/') ||
            urlObj.pathname.includes('/MapServer/');
    } catch {
        return false;
    }
};

// Default configurations
export const defaultFeatureLayerConfig: FeatureLayerConfig = {
    name: '',
    url: '',
    fields: [],
    useDataSource: true,
    displayFields: [],
    aliasFields: {}
};

export const defaultWhatsHereSettings = {
    maxResults: 10,
    searchRadius: 10,
    includeGeometry: false,
    spatialRelationship: 'intersects' as const,
    orderBy: ''
};

export const defaultUISettings = {
    popupWidth: 300,
    popupMaxHeight: 400,
    showLayerNames: true,
    groupByLayer: true,
    showFieldAliases: true
};

// UPDATED: Enhanced default marker settings for simple markers
export const defaultMarkerSettings = {
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

// UPDATED: Enhanced default plot settings for coordinate markers
export const defaultPlotSettings = {
    markerSize: 12,
    markerColor: '#ff6b6b',
    markerStyle: 'circle',
    markerOutlineColor: '#ffffff',
    markerOutlineWidth: 1,
    markerOpacity: 1,
    markerAngle: 0,
    markerXOffset: 0,
    markerYOffset: 0,
    textColor: '#ffffff',
    textSize: 10,
    showCoordinateText: true,
    showCoordinateLabels: true,
    coordinateSystem: 'map' as const,
    customWkid: undefined,
    coordinateFormat: 'decimal' as const,
    decimalPlaces: 6,
    labelOffset: 20,
    labelTextSize: 10,
    labelTextColor: '#000000'
};

// NEW: Default text settings
export const defaultTextSettings = {
    fontSize: 14,
    fontColor: '#000000',
    fontFamily: 'Arial',
    fontWeight: 'bold' as const,
    haloColor: '#ffffff',
    haloSize: 2,
    backgroundColor: 'transparent',
    backgroundOpacity: 0.8
};