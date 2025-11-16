import { React, AllWidgetProps } from 'jimu-core';
import { JimuMapViewComponent, JimuMapView } from 'jimu-arcgis';
import { IMConfig, FeatureLayerConfig, CoordinateMarker, SimpleMarker, TextGraphic } from '../config';

interface State {
    contextMenu: {
        visible: boolean;
        x: number;
        y: number;
        mapPoint?: __esri.Point;
        coordinateLabel?: string;
    };
    showingContextMenu: boolean;
    isMeasuring: boolean;
    measurementWidget: __esri.DistanceMeasurement2D | null;
    isMeasuringArea: boolean;
    areaMeasurementWidget: __esri.Measurement | null;
    layerFieldMetadata: { [layerUrl: string]: { [fieldName: string]: { alias: string; type: string } } };
    // Coordinate plotting state
    coordinateMarkers: CoordinateMarker[];
    nextMarkerNumber: number;
    plotModeActive: boolean;
    // Simple marker state
    simpleMarkers: SimpleMarker[];
    // NEW: Text graphics state
    textGraphics: TextGraphic[];
    showTextDialog: boolean;
    pendingTextLocation: __esri.Point | null;
}

// Enhanced unit and button cleanup function with immediate button hiding
const hideUnwantedUnits = (widget: any, widgetType: 'distance' | 'area' = 'distance') => {
    const unwantedUnits = {
        distance: [
            'imperial', 'metric', 'inches', 'nautical miles', 'nautical-miles',
            'feet (us)', 'feet-us', 'us feet', 'us-feet'
        ],
        area: [
            'imperial', 'metric', 'square inches', 'square-inches',
            'square nautical miles', 'square-nautical-miles',
            'square feet (us)', 'square-feet-us', 'square us feet', 'square-us-feet',
            'ares'
        ]
    };

    const targetUnits = unwantedUnits[widgetType];

    const aggressiveCleanup = () => {
        try {
            const container = widget.container;
            if (container) {
                const buttons = container.querySelectorAll('button, calcite-button');
                buttons.forEach((button: any) => {
                    const text = (button.textContent || '').toLowerCase().trim();
                    if (text.includes('new measurement') || text === 'new measurement') {
                        button.style.display = 'none !important';
                        button.style.visibility = 'hidden';
                        button.hidden = true;
                        button.remove?.();
                    }
                });

                const hints = container.querySelectorAll('.esri-distance-measurement-2d__hint, .esri-area-measurement-2d__hint, .esri-measurement__hint');
                hints.forEach((hint: any) => {
                    hint.style.display = 'none';
                    hint.remove?.();
                });
            }
        } catch (e) {
            // Silent fail
        }
    };

    aggressiveCleanup();
    setTimeout(aggressiveCleanup, 10);
    setTimeout(aggressiveCleanup, 50);
    setTimeout(aggressiveCleanup, 100);

    let attempts = 0;
    const cleanup = () => {
        if (attempts++ > 15) return;

        try {
            const container = widget.container;
            if (container) {
                const selectors = [
                    'calcite-select calcite-option',
                    'select option',
                    '[role="option"]',
                    'calcite-option'
                ];

                selectors.forEach(selector => {
                    const options = container.querySelectorAll(selector);
                    options.forEach((option: any) => {
                        const value = (option.value || '').toLowerCase().trim();
                        const text = (option.textContent || option.innerText || '').toLowerCase().trim();
                        const label = (option.label || '').toLowerCase().trim();

                        const shouldRemove = targetUnits.some(unwantedUnit => {
                            const unwanted = unwantedUnit.toLowerCase();
                            return value === unwanted ||
                                text === unwanted ||
                                label === unwanted ||
                                value.includes(unwanted) ||
                                text.includes(unwanted) ||
                                label.includes(unwanted);
                        });

                        if (shouldRemove) {
                            option.style.display = 'none';
                            option.style.visibility = 'hidden';
                            option.hidden = true;
                            option.disabled = true;
                            try {
                                option.remove();
                            } catch (e) {
                                // Silent fail
                            }
                        }
                    });
                });

                const buttons = container.querySelectorAll('button, calcite-button');
                buttons.forEach((button: any) => {
                    const text = (button.textContent || '').toLowerCase().trim();
                    if (text.includes('new measurement') || text === 'new measurement') {
                        button.style.display = 'none';
                        button.style.visibility = 'hidden';
                        button.hidden = true;
                        try {
                            button.remove();
                        } catch (e) {
                            // Silent fail
                        }
                    }
                });

                const hints = container.querySelectorAll('.esri-distance-measurement-2d__hint, .esri-area-measurement-2d__hint, .esri-measurement__hint');
                hints.forEach((hint: any) => {
                    hint.style.display = 'none';
                    try {
                        hint.remove();
                    } catch (e) {
                        // Silent fail
                    }
                });
            }
        } catch (e) {
            console.warn('Error during cleanup:', e);
        }

        const delays = [50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000];
        if (attempts <= delays.length) {
            setTimeout(cleanup, delays[attempts - 1] || 1000);
        }
    };

    cleanup();
};

const Widget = (props: AllWidgetProps<IMConfig>) => {
    const mapWidgetIds = props.config?.useMapWidgetIds || props.useMapWidgetIds;

    const [state, setState] = React.useState<State>({
        contextMenu: { visible: false, x: 0, y: 0 },
        showingContextMenu: false,
        isMeasuring: false,
        measurementWidget: null,
        isMeasuringArea: false,
        areaMeasurementWidget: null,
        layerFieldMetadata: {},
        // Initialize coordinate plotting state
        coordinateMarkers: [],
        nextMarkerNumber: 1,
        plotModeActive: false,
        // Initialize simple marker state
        simpleMarkers: [],
        // NEW: Initialize text graphics state
        textGraphics: [],
        showTextDialog: false,
        pendingTextLocation: null
    });

    const mapViewRef = React.useRef<__esri.MapView | null>(null);

    // Prevent browser context menu
    React.useEffect(() => {
        const root = document.querySelector('.widget-right-click-map');
        const handler = (e: MouseEvent) => {
            if (e.target instanceof Node && root?.contains(e.target)) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };

        document.addEventListener('contextmenu', handler, { capture: true, passive: false });
        return () => {
            document.removeEventListener('contextmenu', handler, { capture: true });
        };
    }, []);

    // Load field metadata for all configured layers
    React.useEffect(() => {
        const loadFieldMetadata = async () => {
            if (!props.config?.featureLayers?.length) return;

            const metadata: { [layerUrl: string]: { [fieldName: string]: { alias: string; type: string } } } = {};

            for (const layer of props.config.featureLayers) {
                if (!layer.url) continue;

                try {
                    const response = await fetch(`${layer.url}?f=json`);
                    const layerInfo = await response.json();

                    if (layerInfo.fields) {
                        metadata[layer.url] = {};
                        layerInfo.fields.forEach((field: any) => {
                            metadata[layer.url][field.name] = {
                                alias: field.alias || field.name,
                                type: field.type
                            };
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to load field metadata for layer: ${layer.url}`, error);
                }
            }

            setState(prev => ({ ...prev, layerFieldMetadata: metadata }));
        };

        loadFieldMetadata();
    }, [props.config?.featureLayers]);

    const hideContextMenu = React.useCallback(() => {
        setState(prevState => ({
            ...prevState,
            showingContextMenu: false,
            contextMenu: { ...prevState.contextMenu, visible: false }
        }));
    }, []);

    const copyWithPrompt = React.useCallback((coords: string) => {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = coords;
            textArea.style.cssText = 'position:fixed;left:-999999px;top:-999999px;';
            document.body.appendChild(textArea);
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (!successful) {
                prompt('Please copy these coordinates manually:', coords);
            }
        } catch {
            prompt('Please copy these coordinates manually:', coords);
        }
    }, []);

    const projectToLatLon = React.useCallback(async (point: __esri.Point): Promise<__esri.Point> => {
        return new Promise((resolve) => {
            (window as any).require([
                'esri/geometry/projection',
                'esri/geometry/SpatialReference',
                'esri/geometry/Point'
            ], (projection: __esri.projection, SpatialReference: any, Point: any) => {
                projection.load().then(() => {
                    try {
                        const wgs84SR = new SpatialReference({ wkid: 4326 });
                        const sourcePoint = new Point({
                            x: point.x,
                            y: point.y,
                            spatialReference: point.spatialReference
                        });

                        const projectedPoint = projection.project(sourcePoint, wgs84SR) as __esri.Point;

                        if (projectedPoint?.x !== undefined && projectedPoint?.y !== undefined &&
                            Math.abs(projectedPoint.y) <= 90 && Math.abs(projectedPoint.x) <= 180) {
                            resolve(projectedPoint);
                        } else {
                            resolve(point);
                        }
                    } catch {
                        resolve(point);
                    }
                }).catch(() => resolve(point));
            });
        });
    }, []);

    const projectToSpatialReference = React.useCallback(async (point: __esri.Point, wkid: number): Promise<__esri.Point> => {
        return new Promise((resolve) => {
            (window as any).require([
                'esri/geometry/projection',
                'esri/geometry/SpatialReference',
                'esri/geometry/Point'
            ], async (projection: any, SpatialReference: any, Point: any) => {
                try {
                    await projection.load();
                    const spatialRef = new SpatialReference({ wkid });
                    const sourcePoint = new Point({
                        x: point.x,
                        y: point.y,
                        spatialReference: point.spatialReference
                    });

                    const projected = projection.project(sourcePoint, spatialRef);
                    resolve(projected || point);
                } catch {
                    resolve(point);
                }
            });
        });
    }, []);

    const manualProjectToLatLon = React.useCallback((point: __esri.Point): { lat: number, lon: number } => {
        try {
            let lon: number, lat: number;

            if (point.spatialReference?.wkid === 4326 ||
                point.spatialReference?.wkid === 4269 ||
                point.spatialReference?.wkid === 4267) {
                lon = point.x;
                lat = point.y;
            } else {
                const wkid = point.spatialReference?.wkid;

                if (wkid && wkid >= 26901 && wkid <= 26923) {
                    const zone = wkid - 26900;
                    const centralMeridian = (zone - 1) * 6 - 180 + 3;
                    lon = centralMeridian + (point.x - 500000) / 111320;
                    lat = point.y / 110540;
                } else if (point.x > 100000 && point.x < 3000000) {
                    lon = -105 + (point.x - 500000) / 111320;
                    lat = 39 + (point.y - 1000000) / 110540;
                } else {
                    lon = point.x / 111320;
                    lat = point.y / 110540;
                }

                lat = Math.max(-85, Math.min(85, lat));
                lon = Math.max(-180, Math.min(180, lon));
            }

            return { lat, lon };
        } catch {
            return { lat: point.y, lon: point.x };
        }
    }, []);

    const copyCoordinates = React.useCallback(async () => {
        const { mapPoint } = state.contextMenu;
        if (!mapViewRef.current || !mapPoint) return;

        try {
            const coordinateSystem = props.config?.coordinateSystem || 'map';
            let coords: string;

            if (coordinateSystem === 'map') {
                coords = `${mapPoint.x.toFixed(6)}, ${mapPoint.y.toFixed(6)}`;
            } else if (coordinateSystem === 'webMercator') {
                try {
                    const latLonPoint = await projectToLatLon(mapPoint);
                    if (latLonPoint?.x !== undefined && latLonPoint?.y !== undefined &&
                        Math.abs(latLonPoint.y) <= 90 && Math.abs(latLonPoint.x) <= 180) {
                        coords = `${latLonPoint.y.toFixed(6)}, ${latLonPoint.x.toFixed(6)}`;
                    } else {
                        const manualLatLonPoint = manualProjectToLatLon(mapPoint);
                        coords = `${manualLatLonPoint.lat.toFixed(6)}, ${manualLatLonPoint.lon.toFixed(6)}`;
                    }
                } catch {
                    const manualLatLonPoint = manualProjectToLatLon(mapPoint);
                    coords = `${manualLatLonPoint.lat.toFixed(6)}, ${manualLatLonPoint.lon.toFixed(6)}`;
                }
            } else {
                coords = `${mapPoint.x.toFixed(6)}, ${mapPoint.y.toFixed(6)}`;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(coords);
            } else {
                copyWithPrompt(coords);
            }
        } catch (error) {
            alert(`Error copying coordinates: ${error.message}`);
        }
    }, [state.contextMenu, props.config?.coordinateSystem, projectToLatLon, manualProjectToLatLon, copyWithPrompt]);

    // Convert decimal degrees to degrees, minutes, seconds
    const convertToDMS = React.useCallback((decimal: number, type: 'lat' | 'lon'): string => {
        const isNegative = decimal < 0;
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesFloat = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesFloat);
        const seconds = (minutesFloat - minutes) * 60;

        let direction = '';
        if (type === 'lat') {
            direction = isNegative ? 'S' : 'N';
        } else {
            direction = isNegative ? 'W' : 'E';
        }

        return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
    }, []);

    // NEW: Show text input dialog
    const showTextInputDialog = React.useCallback(() => {
        const { mapPoint } = state.contextMenu;
        if (!mapPoint) return;

        setState(prev => ({
            ...prev,
            showTextDialog: true,
            pendingTextLocation: mapPoint
        }));
    }, [state.contextMenu]);

    // NEW: Add text to map
    const addTextToMap = React.useCallback((text: string) => {
        const mapView = mapViewRef.current;
        const location = state.pendingTextLocation;

        if (!mapView || !location || !text.trim()) {
            setState(prev => ({
                ...prev,
                showTextDialog: false,
                pendingTextLocation: null
            }));
            return;
        }

        try {
            const textSettings = props.config?.textSettings || {
                fontSize: 14,
                fontColor: '#000000',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                haloColor: '#ffffff',
                haloSize: 2,
                backgroundColor: 'transparent',
                backgroundOpacity: 0.8
            };

            (window as any).require([
                'esri/Graphic',
                'esri/symbols/TextSymbol',
                'esri/geometry/Point'
            ], (Graphic: any, TextSymbol: any, Point: any) => {
                try {
                    // Create text symbol
                    const textSymbol = new TextSymbol({
                        text: text.trim(),
                        color: textSettings.fontColor,
                        haloColor: textSettings.haloColor,
                        haloSize: textSettings.haloSize,
                        font: {
                            size: textSettings.fontSize,
                            weight: textSettings.fontWeight,
                            family: textSettings.fontFamily
                        },
                        verticalAlignment: 'middle',
                        horizontalAlignment: 'center'
                    });

                    // Add background if specified
                    if (textSettings.backgroundColor && textSettings.backgroundColor !== 'transparent') {
                        textSymbol.backgroundColor = textSettings.backgroundColor;
                        textSymbol.borderLineColor = textSettings.haloColor;
                        textSymbol.borderLineSize = 1;
                    }

                    const point = new Point({
                        x: location.x,
                        y: location.y,
                        spatialReference: location.spatialReference
                    });

                    // Create the text graphic
                    const textGraphic = new Graphic({
                        geometry: point,
                        symbol: textSymbol,
                        attributes: {
                            type: 'text-graphic',
                            text: text.trim()
                        }
                        // No popup template - just text
                    });

                    mapView.graphics.add(textGraphic);

                    // Create text graphic object
                    const newTextGraphic: TextGraphic = {
                        id: `text-graphic-${Date.now()}`,
                        point: location.clone(),
                        graphic: textGraphic,
                        text: text.trim()
                    };

                    // Update state
                    setState(prev => ({
                        ...prev,
                        textGraphics: [...prev.textGraphics, newTextGraphic],
                        showTextDialog: false,
                        pendingTextLocation: null
                    }));

                } catch (error) {
                    console.error('Error creating text graphic:', error);
                    alert('Error creating text graphic: ' + error.message);
                    setState(prev => ({
                        ...prev,
                        showTextDialog: false,
                        pendingTextLocation: null
                    }));
                }
            });

        } catch (error) {
            console.error('Error adding text to map:', error);
            alert(`Error adding text to map: ${error.message}`);
            setState(prev => ({
                ...prev,
                showTextDialog: false,
                pendingTextLocation: null
            }));
        }
    }, [state.pendingTextLocation, props.config?.textSettings]);

    // NEW: Cancel text input dialog
    const cancelTextInput = React.useCallback(() => {
        setState(prev => ({
            ...prev,
            showTextDialog: false,
            pendingTextLocation: null
        }));
    }, []);

    // NEW: Clear all text graphics
    const clearTextGraphics = React.useCallback(() => {
        const mapView = mapViewRef.current;
        if (!mapView) return;

        // Remove all text graphics from map
        const textGraphics = mapView.graphics.filter((graphic: any) => {
            return graphic.attributes?.type === 'text-graphic';
        });

        mapView.graphics.removeMany(textGraphics.toArray());

        // Reset state
        setState(prev => ({
            ...prev,
            textGraphics: []
        }));
    }, []);

    // Plot coordinate marker function
    const plotCoordinate = React.useCallback(async () => {
        const { mapPoint } = state.contextMenu;
        const mapView = mapViewRef.current;
        if (!mapView || !mapPoint) return;

        try {
            const plotSettings = props.config?.plotSettings || {
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
                coordinateSystem: 'map',
                customWkid: undefined,
                coordinateFormat: 'decimal',
                decimalPlaces: 6,
                labelOffset: 20,
                labelTextSize: 10,
                labelTextColor: '#000000'
            };

            let coordinateText: string;
            let coordinateLabel: string; // Short label for map display
            let displayPoint = mapPoint;

            // Handle coordinate system conversion based on plot settings
            if (plotSettings.coordinateSystem === 'webMercator') {
                try {
                    displayPoint = await projectToLatLon(mapPoint);

                    if (displayPoint?.x !== undefined && displayPoint?.y !== undefined &&
                        Math.abs(displayPoint.y) <= 90 && Math.abs(displayPoint.x) <= 180) {
                        if (plotSettings.coordinateFormat === 'dms') {
                            coordinateText = `${convertToDMS(displayPoint.y, 'lat')}\n${convertToDMS(displayPoint.x, 'lon')}`;
                            coordinateLabel = `${convertToDMS(displayPoint.y, 'lat')}\n${convertToDMS(displayPoint.x, 'lon')}`;
                        } else {
                            const latDir = displayPoint.y >= 0 ? 'N' : 'S';
                            const lonDir = displayPoint.x >= 0 ? 'E' : 'W';
                            coordinateText = `Lat: ${Math.abs(displayPoint.y).toFixed(plotSettings.decimalPlaces || 6)}° ${latDir}\nLon: ${Math.abs(displayPoint.x).toFixed(plotSettings.decimalPlaces || 6)}° ${lonDir}`;
                            coordinateLabel = `${Math.abs(displayPoint.y).toFixed(plotSettings.decimalPlaces || 6)}° ${latDir}\n${Math.abs(displayPoint.x).toFixed(plotSettings.decimalPlaces || 6)}° ${lonDir}`;
                        }
                    } else {
                        const manualLatLonPoint = manualProjectToLatLon(mapPoint);
                        if (plotSettings.coordinateFormat === 'dms') {
                            coordinateText = `${convertToDMS(manualLatLonPoint.lat, 'lat')}\n${convertToDMS(manualLatLonPoint.lon, 'lon')}`;
                            coordinateLabel = `${convertToDMS(manualLatLonPoint.lat, 'lat')}\n${convertToDMS(manualLatLonPoint.lon, 'lon')}`;
                        } else {
                            const latDir = manualLatLonPoint.lat >= 0 ? 'N' : 'S';
                            const lonDir = manualLatLonPoint.lon >= 0 ? 'E' : 'W';
                            coordinateText = `Lat: ${Math.abs(manualLatLonPoint.lat).toFixed(plotSettings.decimalPlaces || 6)}° ${latDir}\nLon: ${Math.abs(manualLatLonPoint.lon).toFixed(plotSettings.decimalPlaces || 6)}° ${lonDir}`;
                            coordinateLabel = `${Math.abs(manualLatLonPoint.lat).toFixed(plotSettings.decimalPlaces || 6)}° ${latDir}\n${Math.abs(manualLatLonPoint.lon).toFixed(plotSettings.decimalPlaces || 6)}° ${lonDir}`;
                        }
                    }
                } catch (error) {
                    const manualLatLonPoint = manualProjectToLatLon(mapPoint);
                    if (plotSettings.coordinateFormat === 'dms') {
                        coordinateText = `${convertToDMS(manualLatLonPoint.lat, 'lat')}\n${convertToDMS(manualLatLonPoint.lon, 'lon')}`;
                        coordinateLabel = `${convertToDMS(manualLatLonPoint.lat, 'lat')}\n${convertToDMS(manualLatLonPoint.lon, 'lon')}`;
                    } else {
                        const latDir = manualLatLonPoint.lat >= 0 ? 'N' : 'S';
                        const lonDir = manualLatLonPoint.lon >= 0 ? 'E' : 'W';
                        coordinateText = `Lat: ${Math.abs(manualLatLonPoint.lat).toFixed(plotSettings.decimalPlaces || 6)}° ${latDir}\nLon: ${Math.abs(manualLatLonPoint.lon).toFixed(plotSettings.decimalPlaces || 6)}° ${lonDir}`;
                        coordinateLabel = `${Math.abs(manualLatLonPoint.lat).toFixed(plotSettings.decimalPlaces || 6)}° ${latDir}\n${Math.abs(manualLatLonPoint.lon).toFixed(plotSettings.decimalPlaces || 6)}° ${lonDir}`;
                    }
                }
            } else if (plotSettings.coordinateSystem === 'custom' && plotSettings.customWkid) {
                try {
                    displayPoint = await projectToSpatialReference(mapPoint, plotSettings.customWkid);
                    coordinateText = `X: ${displayPoint.x.toFixed(plotSettings.decimalPlaces || 2)}\nY: ${displayPoint.y.toFixed(plotSettings.decimalPlaces || 2)}\nWKID: ${plotSettings.customWkid}`;
                    coordinateLabel = `${displayPoint.x.toFixed(plotSettings.decimalPlaces || 2)}, ${displayPoint.y.toFixed(plotSettings.decimalPlaces || 2)}`;
                } catch (error) {
                    coordinateText = `X: ${mapPoint.x.toFixed(plotSettings.decimalPlaces || 2)}\nY: ${mapPoint.y.toFixed(plotSettings.decimalPlaces || 2)}\nSR: ${mapPoint.spatialReference?.wkid || 'Unknown'}`;
                    coordinateLabel = `${mapPoint.x.toFixed(plotSettings.decimalPlaces || 2)}, ${mapPoint.y.toFixed(plotSettings.decimalPlaces || 2)}`;
                }
            } else {
                // Use map's native coordinate system
                coordinateText = `X: ${mapPoint.x.toFixed(plotSettings.decimalPlaces || 2)}\nY: ${mapPoint.y.toFixed(plotSettings.decimalPlaces || 2)}\nWKID: ${mapPoint.spatialReference?.wkid || 'Unknown'}`;
                coordinateLabel = `${mapPoint.x.toFixed(plotSettings.decimalPlaces || 2)}, ${mapPoint.y.toFixed(plotSettings.decimalPlaces || 2)}`;
            }

            (window as any).require([
                'esri/Graphic',
                'esri/symbols/SimpleMarkerSymbol',
                'esri/symbols/TextSymbol',
                'esri/geometry/Point'
            ], (Graphic: any, SimpleMarkerSymbol: any, TextSymbol: any, Point: any) => {
                try {
                    const markerNumber = state.nextMarkerNumber;

                    // NEW: Create enhanced marker symbol with all style options
                    const markerSymbol = new SimpleMarkerSymbol({
                        color: plotSettings.markerColor,
                        outline: {
                            color: plotSettings.markerOutlineColor || '#ffffff',
                            width: plotSettings.markerOutlineWidth || 1
                        },
                        size: plotSettings.markerSize,
                        style: plotSettings.markerStyle || 'circle',
                        // Add rotation, offsets, and opacity
                        angle: plotSettings.markerAngle || 0,
                        xoffset: plotSettings.markerXOffset || 0,
                        yoffset: plotSettings.markerYOffset || 0
                    });

                    // Apply opacity if supported
                    if (plotSettings.markerOpacity !== undefined && plotSettings.markerOpacity !== 1) {
                        markerSymbol.color = [
                            ...markerSymbol.color.toRgb(),
                            plotSettings.markerOpacity
                        ];
                    }

                    // Create the number text symbol
                    const numberSymbol = new TextSymbol({
                        text: markerNumber.toString(),
                        color: plotSettings.textColor,
                        font: {
                            size: plotSettings.textSize,
                            weight: 'bold',
                            family: 'Arial'
                        },
                        verticalAlignment: 'middle',
                        horizontalAlignment: 'center',
                        // Apply same offsets to text as marker
                        xoffset: plotSettings.markerXOffset || 0,
                        yoffset: plotSettings.markerYOffset || 0
                    });

                    const point = new Point({
                        x: mapPoint.x,
                        y: mapPoint.y,
                        spatialReference: mapPoint.spatialReference
                    });

                    // Create popup content
                    let popupContent = `<div style="font-family: monospace; font-size: 12px; line-height: 1.6; padding: 8px;">`;
                    popupContent += `<div style="font-weight: bold; margin-bottom: 8px;">Marker ${markerNumber}</div>`;

                    if (plotSettings.showCoordinateText) {
                        popupContent += `<div style="background-color: #f5f5f5; padding: 6px; border-radius: 3px; white-space: pre-line;">${coordinateText}</div>`;
                    }

                    popupContent += `</div>`;

                    // Create the marker graphic
                    const markerGraphic = new Graphic({
                        geometry: point,
                        symbol: markerSymbol,
                        attributes: {
                            type: 'coordinate-marker',
                            number: markerNumber,
                            coordinates: coordinateText,
                            originalX: mapPoint.x,
                            originalY: mapPoint.y,
                            wkid: mapPoint.spatialReference?.wkid
                        },
                        popupTemplate: {
                            title: `📍 Coordinate Marker ${markerNumber}`,
                            content: popupContent
                        }
                    });

                    // Create the number text graphic
                    const textGraphic = new Graphic({
                        geometry: point,
                        symbol: numberSymbol,
                        attributes: {
                            type: 'coordinate-text',
                            parentMarker: markerNumber
                        }
                    });

                    // Add the main graphics first
                    mapView.graphics.addMany([markerGraphic, textGraphic]);

                    // Create coordinate label graphic (if enabled)
                    if (plotSettings.showCoordinateLabels !== false) { // Default to true if undefined

                        // Calculate offset position for label - use a simple pixel-based offset
                        const offsetPixels = plotSettings.labelOffset || 20;
                        const currentScale = mapView.scale;
                        const mapUnitsPerPixel = currentScale / 96 / 39.37; // Convert to map units
                        const offsetMapUnits = offsetPixels * mapUnitsPerPixel;

                        const labelPoint = new Point({
                            x: mapPoint.x + offsetMapUnits,
                            y: mapPoint.y - offsetMapUnits, // Offset down and right
                            spatialReference: mapPoint.spatialReference
                        });

                        // Create label symbol
                        const labelSymbol = new TextSymbol({
                            text: coordinateLabel,
                            color: plotSettings.labelTextColor || '#000000',
                            haloColor: '#ffffff',
                            haloSize: 2,
                            font: {
                                size: plotSettings.labelTextSize || 10,
                                weight: 'normal',
                                family: 'Arial'
                            },
                            verticalAlignment: 'top',
                            horizontalAlignment: 'left'
                        });

                        const labelGraphic = new Graphic({
                            geometry: labelPoint,
                            symbol: labelSymbol,
                            attributes: {
                                type: 'coordinate-label',
                                parentMarker: markerNumber
                            }
                        });

                        mapView.graphics.add(labelGraphic);
                    }

                    // Create coordinate marker object
                    const newMarker: CoordinateMarker = {
                        id: `marker-${markerNumber}`,
                        number: markerNumber,
                        point: mapPoint.clone(),
                        graphic: markerGraphic,
                        coordinateText: coordinateText
                    };

                    // Update state
                    setState(prev => ({
                        ...prev,
                        coordinateMarkers: [...prev.coordinateMarkers, newMarker],
                        nextMarkerNumber: prev.nextMarkerNumber + 1
                    }));

                } catch (error) {
                    console.error('Error creating coordinate marker:', error);
                    alert('Error creating coordinate marker: ' + error.message);
                }
            });

        } catch (error) {
            console.error('Error plotting coordinate:', error);
            alert(`Error plotting coordinate: ${error.message}`);
        }
    }, [state.contextMenu, state.nextMarkerNumber, props.config?.plotSettings, projectToLatLon, manualProjectToLatLon, projectToSpatialReference, convertToDMS]);

    // Plot simple marker function
    const plotSimpleMarker = React.useCallback(async () => {
        const { mapPoint } = state.contextMenu;
        const mapView = mapViewRef.current;
        if (!mapView || !mapPoint) return;

        try {
            const markerSettings = props.config?.markerSettings || {
                markerSize: 8,
                markerColor: '#0078ff',
                markerStyle: 'circle',
                markerOutlineColor: '#ffffff',
                markerOutlineWidth: 1,
                markerOpacity: 1,
                markerAngle: 0,
                markerXOffset: 0,
                markerYOffset: 0
            };

            (window as any).require([
                'esri/Graphic',
                'esri/symbols/SimpleMarkerSymbol',
                'esri/geometry/Point'
            ], (Graphic: any, SimpleMarkerSymbol: any, Point: any) => {
                try {
                    // NEW: Create enhanced simple marker symbol with all style options
                    const markerSymbol = new SimpleMarkerSymbol({
                        color: markerSettings.markerColor,
                        outline: {
                            color: markerSettings.markerOutlineColor || '#ffffff',
                            width: markerSettings.markerOutlineWidth || 1
                        },
                        size: markerSettings.markerSize,
                        style: markerSettings.markerStyle || 'circle',
                        // Add rotation, offsets
                        angle: markerSettings.markerAngle || 0,
                        xoffset: markerSettings.markerXOffset || 0,
                        yoffset: markerSettings.markerYOffset || 0
                    });

                    // Apply opacity if supported
                    if (markerSettings.markerOpacity !== undefined && markerSettings.markerOpacity !== 1) {
                        markerSymbol.color = [
                            ...markerSymbol.color.toRgb(),
                            markerSettings.markerOpacity
                        ];
                    }

                    const point = new Point({
                        x: mapPoint.x,
                        y: mapPoint.y,
                        spatialReference: mapPoint.spatialReference
                    });

                    // Create the marker graphic
                    const markerGraphic = new Graphic({
                        geometry: point,
                        symbol: markerSymbol,
                        attributes: {
                            type: 'simple-marker'
                        }
                        // No popup template - just a simple marker
                    });

                    mapView.graphics.add(markerGraphic);

                    // Create simple marker object
                    const newMarker: SimpleMarker = {
                        id: `simple-marker-${Date.now()}`,
                        point: mapPoint.clone(),
                        graphic: markerGraphic
                    };

                    // Update state
                    setState(prev => ({
                        ...prev,
                        simpleMarkers: [...prev.simpleMarkers, newMarker]
                    }));

                } catch (error) {
                    console.error('Error creating simple marker:', error);
                    alert('Error creating simple marker: ' + error.message);
                }
            });

        } catch (error) {
            console.error('Error plotting simple marker:', error);
            alert(`Error plotting simple marker: ${error.message}`);
        }
    }, [state.contextMenu, props.config?.markerSettings]);

    // Clear all coordinate markers
    const clearCoordinateMarkers = React.useCallback(() => {
        const mapView = mapViewRef.current;
        if (!mapView) return;

        // Remove all coordinate graphics from map
        const coordinateGraphics = mapView.graphics.filter((graphic: any) => {
            return graphic.attributes?.type === 'coordinate-marker' ||
                graphic.attributes?.type === 'coordinate-text' ||
                graphic.attributes?.type === 'coordinate-label';
        });

        mapView.graphics.removeMany(coordinateGraphics.toArray());

        // Reset state
        setState(prev => ({
            ...prev,
            coordinateMarkers: [],
            nextMarkerNumber: 1
        }));
    }, []);

    // Clear all simple markers
    const clearSimpleMarkers = React.useCallback(() => {
        const mapView = mapViewRef.current;
        if (!mapView) return;

        // Remove all simple marker graphics from map
        const simpleMarkerGraphics = mapView.graphics.filter((graphic: any) => {
            return graphic.attributes?.type === 'simple-marker';
        });

        mapView.graphics.removeMany(simpleMarkerGraphics.toArray());

        // Reset state
        setState(prev => ({
            ...prev,
            simpleMarkers: []
        }));
    }, []);

    // UPDATED: Clear all graphics (renamed from clearAllMarkers)
    const clearAllGraphics = React.useCallback(() => {
        const mapView = mapViewRef.current;
        if (!mapView) return;

        // Remove ALL graphics from map (markers + text)
        const allGraphics = mapView.graphics.filter((graphic: any) => {
            return graphic.attributes?.type === 'coordinate-marker' ||
                graphic.attributes?.type === 'coordinate-text' ||
                graphic.attributes?.type === 'coordinate-label' ||
                graphic.attributes?.type === 'simple-marker' ||
                graphic.attributes?.type === 'text-graphic';
        });

        mapView.graphics.removeMany(allGraphics.toArray());

        // Reset all states
        setState(prev => ({
            ...prev,
            coordinateMarkers: [],
            nextMarkerNumber: 1,
            simpleMarkers: [],
            textGraphics: []
        }));

    }, []);

    const openStreetView = React.useCallback(async () => {
        const { mapPoint } = state.contextMenu;
        if (!mapViewRef.current || !mapPoint) return;

        try {
            let lat: number, lon: number;

            try {
                const latLonPoint = await projectToLatLon(mapPoint);
                if (latLonPoint?.x !== undefined && latLonPoint?.y !== undefined &&
                    Math.abs(latLonPoint.y) <= 90 && Math.abs(latLonPoint.x) <= 180) {
                    lat = latLonPoint.y;
                    lon = latLonPoint.x;
                } else {
                    const manualLatLon = manualProjectToLatLon(mapPoint);
                    lat = manualLatLon.lat;
                    lon = manualLatLon.lon;
                }
            } catch {
                const manualLatLon = manualProjectToLatLon(mapPoint);
                lat = manualLatLon.lat;
                lon = manualLatLon.lon;
            }

            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                alert('Invalid coordinates - cannot open Street View');
                return;
            }

            const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
            window.open(streetViewUrl, '_blank');
        } catch (error) {
            alert(`Error opening Street View: ${error.message}`);
        }
    }, [state.contextMenu, projectToLatLon, manualProjectToLatLon]);

    const openPictometryView = React.useCallback(async () => {
        const { mapPoint } = state.contextMenu;
        if (!mapViewRef.current || !mapPoint || !props.config?.pictometryUrl) return;

        try {
            let lat: number, lon: number;

            try {
                const latLonPoint = await projectToLatLon(mapPoint);
                if (
                    latLonPoint?.x !== undefined &&
                    latLonPoint?.y !== undefined &&
                    Math.abs(latLonPoint.y) <= 90 &&
                    Math.abs(latLonPoint.x) <= 180
                ) {
                    lat = latLonPoint.y;
                    lon = latLonPoint.x;
                } else {
                    const manualLatLon = manualProjectToLatLon(mapPoint);
                    lat = manualLatLon.lat;
                    lon = manualLatLon.lon;
                }
            } catch {
                const manualLatLon = manualProjectToLatLon(mapPoint);
                lat = manualLatLon.lat;
                lon = manualLatLon.lon;
            }

            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                alert('Invalid coordinates - cannot open Pictometry');
                return;
            }

            const pictometryUrl = `${props.config.pictometryUrl}?x=${lon.toFixed(8)}&y=${lat.toFixed(8)}`;
            window.open(pictometryUrl, '_blank');
        } catch (error: any) {
            alert(`Error opening Pictometry: ${error.message}`);
        }
    }, [state.contextMenu, projectToLatLon, manualProjectToLatLon, props.config?.pictometryUrl]);

    const startMeasurement = React.useCallback(async () => {
        const mapView = mapViewRef.current;
        if (!mapView) return;

        try {
            if (state.measurementWidget) {
                state.measurementWidget.destroy();
            }

            // Only remove measurement-related graphics, not all graphics
            const measurementGraphics = mapView.graphics.filter((graphic: any) => {
                return graphic.attributes?.type === 'segment-label' ||
                    graphic.attributes?.type === 'total-label' ||
                    graphic.attributes?.type === 'measurement-graphic';
            });
            mapView.graphics.removeMany(measurementGraphics.toArray());

            const validUnits = ['feet', 'yards', 'miles', 'meters', 'kilometers'];
            const measurementSettings = props.config?.measurementSettings || {
                defaultUnits: 'feet',
                unitDisplay: 'single'
            };

            (window as any).require([
                'esri/widgets/DistanceMeasurement2D',
                'esri/Graphic',
                'esri/symbols/TextSymbol',
                'esri/geometry/geometryEngine',
                'esri/geometry/Point'
            ], (DistanceMeasurement2D: any, Graphic: any, TextSymbol: any, geometryEngine: any, Point: any) => {
                try {
                    const distanceMeasurement2D = new DistanceMeasurement2D({ view: mapView });

                    let primaryUnit: string = 'feet';
                    let secondaryUnit: string | null = null;

                    if (validUnits.includes(measurementSettings.defaultUnits)) {
                        primaryUnit = measurementSettings.defaultUnits;
                    }

                    if (measurementSettings.unitDisplay === 'both') {
                        switch (primaryUnit) {
                            case 'feet': secondaryUnit = 'meters'; break;
                            case 'meters': secondaryUnit = 'feet'; break;
                            case 'miles': secondaryUnit = 'kilometers'; break;
                            case 'kilometers': secondaryUnit = 'miles'; break;
                            case 'yards': secondaryUnit = 'meters'; break;
                        }
                    }

                    const initializeDistanceUnit = () => {
                        try {
                            distanceMeasurement2D.unit = primaryUnit;
                            if (distanceMeasurement2D.viewModel) {
                                distanceMeasurement2D.viewModel.unit = primaryUnit;
                            }
                        } catch (e) {
                            console.warn('Error setting initial distance unit:', e);
                        }
                    };

                    mapView.ui.add(distanceMeasurement2D, 'top-right');
                    initializeDistanceUnit();

                    distanceMeasurement2D.when(() => {
                        hideUnwantedUnits(distanceMeasurement2D, 'distance');
                        setTimeout(() => initializeDistanceUnit(), 100);
                        setTimeout(() => initializeDistanceUnit(), 300);
                        setTimeout(() => initializeDistanceUnit(), 500);
                    });

                    setTimeout(() => {
                        distanceMeasurement2D.viewModel.start();
                        initializeDistanceUnit();
                    }, 200);

                    const formatDistance = (distance: number, unit: string): string => {
                        let formatted = `${distance.toFixed(2)} ${unit}`;
                        if (secondaryUnit && measurementSettings.unitDisplay === 'both') {
                            const conversions: Record<string, number> = {
                                'feet->meters': 0.3048, 'meters->feet': 3.28084,
                                'miles->kilometers': 1.60934, 'kilometers->miles': 0.621371,
                                'yards->meters': 0.9144, 'meters->yards': 1.09361
                            };
                            const key = `${unit}->${secondaryUnit}`;
                            const factor = conversions[key] ?? 1;
                            const converted = distance * factor;
                            formatted += ` (${converted.toFixed(2)} ${secondaryUnit})`;
                        }
                        return formatted;
                    };

                    const createLabel = (pt: __esri.Point, text: string, attrType: string) => {
                        const label = new Graphic({
                            geometry: pt,
                            symbol: new TextSymbol({
                                text,
                                color: [255, 255, 255],
                                haloColor: [0, 0, 0],
                                haloSize: 2,
                                font: { size: 12, family: 'Arial', weight: 'bold' },
                                verticalAlignment: 'middle',
                                horizontalAlignment: 'center'
                            }),
                            attributes: { type: attrType }
                        });
                        mapView.graphics.add(label);
                    };

                    const drawLabels = (geometry: __esri.Geometry, unit: string) => {
                        const polyline = geometry as __esri.Polyline;
                        const path = polyline.paths?.[0];
                        if (!path) return;

                        const points = path.map(([x, y]) => new Point({ x, y, spatialReference: mapView.spatialReference }));
                        let total = 0;

                        for (let i = 0; i < points.length - 1; i++) {
                            const seg = geometryEngine.distance(points[i], points[i + 1], unit);
                            total += seg;
                            const mid = new Point({
                                x: (points[i].x + points[i + 1].x) / 2,
                                y: (points[i].y + points[i + 1].y) / 2,
                                spatialReference: mapView.spatialReference
                            });
                            createLabel(mid, formatDistance(seg, unit), 'segment-label');
                        }

                        if (points.length > 1) {
                            const offset = new Point({
                                x: points.at(-1)!.x,
                                y: points.at(-1)!.y + (mapView.extent.height * 0.01),
                                spatialReference: mapView.spatialReference
                            });
                            createLabel(offset, `Total: ${formatDistance(total, unit)}`, 'total-label');
                        }
                    };

                    const clearLabels = () => {
                        const labels = mapView.graphics.filter((g: any) =>
                            ['segment-label', 'total-label'].includes(g.attributes?.type)
                        );
                        mapView.graphics.removeMany(labels.toArray());
                    };

                    const watchHandles: __esri.WatchHandle[] = [];

                    watchHandles.push(distanceMeasurement2D.viewModel.watch('measurement', (m: any) => {
                        if (!m?.geometry) return;
                        clearLabels();
                        drawLabels(m.geometry, distanceMeasurement2D.unit);
                    }));

                    watchHandles.push(distanceMeasurement2D.watch('unit', (newUnit: string) => {
                        if (!validUnits.includes(newUnit)) {
                            console.warn(`Invalid unit received: ${newUnit}. Reverting to primary unit: ${primaryUnit}`);
                            setTimeout(() => {
                                distanceMeasurement2D.unit = primaryUnit;
                            }, 50);
                            return;
                        }
                        const m = distanceMeasurement2D.viewModel.measurement;
                        if (!m?.geometry) return;
                        clearLabels();
                        drawLabels(m.geometry, newUnit);
                    }));

                    watchHandles.push(distanceMeasurement2D.viewModel.watch('state', (s: string) => {
                        if (s === 'ready') clearLabels();
                    }));

                    const cleanup = () => {
                        clearLabels();
                        watchHandles.forEach(h => h.remove());
                        mapView.ui.remove(distanceMeasurement2D);
                        distanceMeasurement2D.destroy();
                        setState(prev => ({ ...prev, isMeasuring: false, measurementWidget: null }));
                    };

                    const handleKey = (e: KeyboardEvent) => {
                        if (e.key === 'Escape') {
                            cleanup();
                            document.removeEventListener('keydown', handleKey);
                        }
                    };
                    document.addEventListener('keydown', handleKey);

                    distanceMeasurement2D.when(() => {
                        const widget = distanceMeasurement2D.container;
                        if (!widget) return;

                        setTimeout(() => {
                            const container = document.createElement('div');
                            container.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:12px;padding:0 12px 12px;';

                            const closeBtn = document.createElement('button');
                            closeBtn.textContent = 'Close';
                            closeBtn.style.cssText = 'background:#6c757d;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;';
                            closeBtn.onmouseenter = () => closeBtn.style.background = '#545b62';
                            closeBtn.onmouseleave = () => closeBtn.style.background = '#6c757d';
                            closeBtn.onclick = (e) => {
                                e.preventDefault(); e.stopPropagation();
                                cleanup();
                                document.removeEventListener('keydown', handleKey);
                            };

                            container.appendChild(closeBtn);
                            widget.appendChild(container);

                            widget.style.cssText += 'background:rgba(255,255,255,0.95);backdrop-filter:blur(10px);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:1px solid rgba(0,0,0,0.1);min-width:260px;';
                        }, 300);
                    });

                    setState(prev => ({
                        ...prev,
                        isMeasuring: true,
                        measurementWidget: distanceMeasurement2D
                    }));
                } catch (err: any) {
                    console.error(`Error starting measurement: ${err.message}`);
                }
            });
        } catch (err: any) {
            console.error(`Error loading measurement tools: ${err.message}`);
        }
    }, [state.measurementWidget, props.config?.measurementSettings]);

    const startAreaMeasurement = React.useCallback(async () => {
        const mapView = mapViewRef.current;
        if (!mapView) return;

        try {
            if (state.areaMeasurementWidget) {
                state.areaMeasurementWidget.destroy();
            }

            // Only remove measurement-related graphics, not all graphics
            const measurementGraphics = mapView.graphics.filter((graphic: any) => {
                return graphic.attributes?.type === 'segment-label' ||
                    graphic.attributes?.type === 'total-label' ||
                    graphic.attributes?.type === 'measurement-graphic';
            });
            mapView.graphics.removeMany(measurementGraphics.toArray());

            const measurementSettings = props.config?.measurementSettings || {
                defaultUnits: 'feet',
                unitDisplay: 'single'
            };

            (window as any).require([
                'esri/widgets/AreaMeasurement2D',
                'esri/Graphic',
                'esri/symbols/TextSymbol',
                'esri/geometry/geometryEngine',
                'esri/geometry/Point'
            ], (AreaMeasurement2D: any, Graphic: any, TextSymbol: any, geometryEngine: any, Point: any) => {
                try {
                    const areaMeasurement2D = new AreaMeasurement2D({ view: mapView });
                    const measurement = areaMeasurement2D;

                    let primaryUnit: string;
                    let secondaryUnit: string | null = null;

                    switch (measurementSettings.defaultUnits) {
                        case 'feet': primaryUnit = 'square-feet'; break;
                        case 'meters': primaryUnit = 'square-meters'; break;
                        case 'miles': primaryUnit = 'square-miles'; break;
                        case 'kilometers': primaryUnit = 'square-kilometers'; break;
                        case 'yards': primaryUnit = 'square-yards'; break;
                        default: primaryUnit = 'square-feet';
                    }

                    if (measurementSettings.unitDisplay === 'both') {
                        switch (measurementSettings.defaultUnits) {
                            case 'feet': secondaryUnit = 'square-meters'; break;
                            case 'meters': secondaryUnit = 'square-feet'; break;
                            case 'miles': secondaryUnit = 'square-kilometers'; break;
                            case 'kilometers': secondaryUnit = 'square-miles'; break;
                            case 'yards': secondaryUnit = 'square-meters'; break;
                        }
                    }

                    const initializeUnit = () => {
                        try {
                            measurement.unit = primaryUnit;
                            if (measurement.viewModel) {
                                measurement.viewModel.unit = primaryUnit;
                            }
                        } catch (e) {
                            console.warn('Error setting initial unit:', e);
                        }
                    };

                    mapView.ui.add(measurement, 'top-right');
                    initializeUnit();

                    measurement.when(() => {
                        hideUnwantedUnits(measurement, 'area');
                        setTimeout(() => initializeUnit(), 100);
                        setTimeout(() => initializeUnit(), 300);
                        setTimeout(() => initializeUnit(), 500);

                        const widget = measurement.container;
                        if (!widget) return;

                        setTimeout(() => {
                            const container = document.createElement('div');
                            container.style.cssText = 'display:flex;justify-content:center;gap:8px;margin-top:12px;padding:0 12px 12px;';

                            const closeBtn = document.createElement('button');
                            closeBtn.textContent = 'Close';
                            closeBtn.style.cssText = 'background:#6c757d;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500;';
                            closeBtn.onmouseenter = () => closeBtn.style.background = '#545b62';
                            closeBtn.onmouseleave = () => closeBtn.style.background = '#6c757d';
                            closeBtn.onclick = (e) => {
                                e.preventDefault(); e.stopPropagation();
                                cleanup();
                                document.removeEventListener('keydown', handleKeyPress);
                            };

                            container.appendChild(closeBtn);
                            widget.appendChild(container);

                            widget.style.cssText += 'background:rgba(255,255,255,0.95);backdrop-filter:blur(10px);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:1px solid rgba(0,0,0,0.1);min-width:260px;';
                        }, 300);
                    });

                    setTimeout(() => {
                        measurement.viewModel.start();
                        initializeUnit();
                    }, 200);

                    measurement.watch('unit', (newUnit: string) => {
                        const validAreaUnits = ['square-feet', 'square-yards', 'square-miles', 'square-meters', 'square-kilometers', 'acres'];
                        if (!validAreaUnits.includes(newUnit)) {
                            console.warn(`Invalid area unit received: ${newUnit}. Reverting to primary unit: ${primaryUnit}`);
                            setTimeout(() => {
                                measurement.unit = primaryUnit;
                            }, 50);
                        }
                    });

                    setState(prevState => ({
                        ...prevState,
                        isMeasuringArea: true,
                        areaMeasurementWidget: measurement as any
                    }));

                    const cleanup = () => {
                        if (measurement) {
                            mapView.ui.remove(measurement);
                            measurement.destroy();
                        }
                        setState(prevState => ({
                            ...prevState,
                            isMeasuringArea: false,
                            areaMeasurementWidget: null
                        }));
                    };

                    const handleKeyPress = (event: KeyboardEvent) => {
                        if (event.key === 'Escape') {
                            cleanup();
                            document.removeEventListener('keydown', handleKeyPress);
                        }
                    };
                    document.addEventListener('keydown', handleKeyPress);

                } catch (error) {
                    console.error(`Error starting area measurement: ${error.message}`);
                }
            });

        } catch (error) {
            console.error(`Error loading area measurement tools: ${error.message}`);
        }
    }, [state.areaMeasurementWidget, props.config?.measurementSettings]);

    const queryFeatureLayer = React.useCallback(async (
        layer: FeatureLayerConfig,
        mapPoint: __esri.Point
    ): Promise<{ layerName: string; features: any[]; layerUrl: string }> => {
        try {
            const whatsHereSettings = props.config?.whatsHereSettings || {};

            // Use the original map point coordinate system for the query
            let queryPoint = mapPoint;

            // Only project if a specific target WKID is configured
            if (props.config?.reverseGeocodeWkid && props.config.reverseGeocodeWkid !== mapPoint.spatialReference?.wkid) {
                try {
                    queryPoint = await projectToSpatialReference(mapPoint, props.config.reverseGeocodeWkid);
                } catch (projectionError) {
                    console.warn(`Projection failed, using original coordinates:`, projectionError);
                    queryPoint = mapPoint;
                }
            }

            const queryUrl = `${layer.url}/query`;

            // Create geometry object properly
            const geometryObj = {
                x: queryPoint.x,
                y: queryPoint.y,
                spatialReference: {
                    wkid: queryPoint.spatialReference?.wkid || 4326
                }
            };

            // Ensure proper spatial relationship values
            const defaultSpatialRel = whatsHereSettings.spatialRelationship || 'esriSpatialRelIntersects';

            // Validate and fix spatial relationship values
            const validSpatialRel = defaultSpatialRel.startsWith('esriSpatialRel')
                ? defaultSpatialRel
                : `esriSpatialRel${defaultSpatialRel.charAt(0).toUpperCase()}${defaultSpatialRel.slice(1)}`;

            const spatialRelationships = [
                validSpatialRel,
                'esriSpatialRelIntersects',
                'esriSpatialRelContains',
                'esriSpatialRelWithin'
            ];

            // Try without distance first, then with distance, then with simplified parameters
            const queryAttempts = [];

            // Attempt 1: Basic query
            queryAttempts.push({
                geometry: JSON.stringify(geometryObj),
                geometryType: 'esriGeometryPoint',
                spatialRel: spatialRelationships[0],
                outFields: (layer.fields && layer.fields.length > 0) ? layer.fields.join(',') : '*',
                returnGeometry: whatsHereSettings.includeGeometry ? 'true' : 'false',
                resultRecordCount: (whatsHereSettings.maxResults || 10).toString(),
                f: 'json'
            });

            // Attempt 2: With buffer if configured
            if (whatsHereSettings.searchRadius && whatsHereSettings.searchRadius > 0) {
                queryAttempts.push({
                    geometry: JSON.stringify(geometryObj),
                    geometryType: 'esriGeometryPoint',
                    spatialRel: spatialRelationships[0],
                    outFields: (layer.fields && layer.fields.length > 0) ? layer.fields.join(',') : '*',
                    returnGeometry: whatsHereSettings.includeGeometry ? 'true' : 'false',
                    resultRecordCount: (whatsHereSettings.maxResults || 10).toString(),
                    distance: whatsHereSettings.searchRadius.toString(),
                    units: 'esriSRUnit_Meter',
                    f: 'json'
                });
            }

            // Attempt 3: Simplified query with just coordinates
            queryAttempts.push({
                geometry: `${queryPoint.x},${queryPoint.y}`,
                geometryType: 'esriGeometryPoint',
                spatialRel: 'esriSpatialRelIntersects',
                outFields: '*',
                returnGeometry: 'false',
                f: 'json'
            });

            // Attempt 4: Using envelope instead of point
            const tolerance = 1; // 1 meter tolerance
            const envelope = {
                xmin: queryPoint.x - tolerance,
                ymin: queryPoint.y - tolerance,
                xmax: queryPoint.x + tolerance,
                ymax: queryPoint.y + tolerance,
                spatialReference: { wkid: queryPoint.spatialReference?.wkid || 4326 }
            };

            queryAttempts.push({
                geometry: JSON.stringify(envelope),
                geometryType: 'esriGeometryEnvelope',
                spatialRel: 'esriSpatialRelIntersects',
                outFields: (layer.fields && layer.fields.length > 0) ? layer.fields.join(',') : '*',
                returnGeometry: 'false',
                f: 'json'
            });

            let lastError = null;

            for (let attemptIndex = 0; attemptIndex < queryAttempts.length; attemptIndex++) {
                const queryParams = queryAttempts[attemptIndex];
                const params = new URLSearchParams(queryParams);
                // Add ordering if specified
                if (whatsHereSettings.orderBy) {
                    params.append('orderByFields', whatsHereSettings.orderBy);
                }
                try {
                    const response = await fetch(`${queryUrl}?${params.toString()}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    const json = await response.json();
                    if (json.error) {
                        lastError = new Error(`[${json.error.code || 'Unknown'}] ${json.error.message || `Query failed for layer ${layer.name}`}`);
                        continue; // Try next attempt
                    }
                    return {
                        layerName: layer.name,
                        features: json.features || [],
                        layerUrl: layer.url
                    };
                } catch (error) {
                    lastError = error;
                }
            }

            // If we get here, all attempts failed
            throw lastError || new Error(`All query attempts failed for layer ${layer.name}`);

        } catch (error) {
            console.error(`Error querying layer ${layer.name}:`, error);
            // Return empty result instead of throwing to prevent breaking other layers
            return { layerName: layer.name, features: [], layerUrl: layer.url };
        }
    }, [projectToSpatialReference, props.config]);

    const generatePopupContent = React.useCallback((results: Array<{ layerName: string; features: any[]; layerUrl: string }>): string => {
    const uiSettings = props.config?.uiSettings || {};
    const showLayerNames = uiSettings.showLayerNames !== false;
    const groupByLayer = uiSettings.groupByLayer !== false;
    const showFieldAliases = uiSettings.showFieldAliases !== false;

    let content = '';

    results.forEach(({ layerName, features, layerUrl }, layerIndex) => {
        if (features.length === 0) return;

        if (showLayerNames && groupByLayer) {
            content += `
                    <div style="
                        font-weight: 600; 
                        color: #323232; 
                        margin: ${layerIndex > 0 ? '20px' : '0px'} 0 12px 0; 
                        padding-bottom: 6px;
                        border-bottom: 2px solid #0079c1;
                        font-size: 15px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">
                        ${layerName}
                    </div>
                `;
        }

        features.forEach((feature, featureIndex) => {
            const attributes = feature.attributes;

            if (!groupByLayer && showLayerNames) {
                content += `
                        <div style="
                            display: flex;
                            align-items: flex-start;
                            margin-bottom: 8px;
                            padding: 6px 0;
                            border-bottom: 1px solid #e0e0e0;
                        ">
                            <div style="
                                font-weight: 600;
                                color: #0079c1;
                                white-space: nowrap;
                                flex-shrink: 0;
                                min-width: 60px;
                                font-size: 13px;
                            ">
                                Layer:
                            </div>
                            <div style="
                                color: #323232;
                                word-wrap: break-word;
                                flex: 1;
                                margin-left: 8px;
                                font-size: 13px;
                            ">
                                ${layerName}
                            </div>
                        </div>
                    `;
            }

            const filteredAttributes = Object.entries(attributes).filter(([fieldName, value]) => {
                if (['OBJECTID', 'FID', 'SHAPE', 'Shape', 'GlobalID', 'GLOBALID'].includes(fieldName)) {
                    return false;
                }
                return value !== null && value !== undefined && value !== '';
            });

            filteredAttributes.forEach(([fieldName, value]) => {
                const displayName = getFieldDisplayName(fieldName, layerUrl, showFieldAliases);
                const formattedValue = formatFieldValue(value, fieldName);

                content += `
                        <div style="
                            display: flex;
                            align-items: flex-start;
                            margin-bottom: 6px;
                            padding: 2px 0;
                            min-height: 20px;
                        ">
                            <div style="
                                font-weight: 600;
                                color: #0079c1;
                                white-space: nowrap;
                                flex-shrink: 0;
                                min-width: 120px;
                                font-size: 13px;
                                line-height: 1.4;
                            ">
                                ${displayName}:
                            </div>
                            <div style="
                                color: #323232;
                                word-wrap: break-word;
                                flex: 1;
                                margin-left: 8px;
                                font-size: 13px;
                                line-height: 1.4;
                            ">
                                ${formattedValue}
                            </div>
                        </div>
                    `;
            });

            if (featureIndex < features.length - 1) {
                content += '<div style="margin: 16px 0; border-bottom: 1px solid #e8e8e8;"></div>';
            }
        });
    });

    return content || '<div style="color: #6e6e6e; font-style: italic; text-align: center; padding: 20px;">No features found at this location.</div>';
}, [props.config?.uiSettings, state.layerFieldMetadata]);

    const getFieldDisplayName = React.useCallback((fieldName: string, layerUrl: string, useAliases: boolean): string => {
    if (!useAliases) return fieldName;

    const fieldMetadata = state.layerFieldMetadata[layerUrl]?.[fieldName];
    if (fieldMetadata?.alias && fieldMetadata.alias !== fieldName) {
        return fieldMetadata.alias;
    }

    const layer = props.config?.featureLayers?.find(l => l.url === layerUrl);
    if (layer?.aliasFields?.[fieldName]) {
        return layer.aliasFields[fieldName];
    }

    const commonAliases: Record<string, string> = {
        'OBJECTID': 'Object ID',
        'ObjectID': 'Object ID',
        'FID': 'Feature ID',
        'SHAPE': 'Geometry',
        'Shape': 'Geometry',
        'SHAPE_Area': 'Area',
        'SHAPE_Length': 'Length',
        'Shape_Area': 'Area',
        'Shape_Length': 'Length',
        'CREATED_DATE': 'Created Date',
        'LAST_EDITED_DATE': 'Last Modified',
        'CreationDate': 'Created Date',
        'EditDate': 'Last Modified',
        'GlobalID': 'Global ID',
        'GLOBALID': 'Global ID',
        'NAME': 'Name',
        'Name': 'Name',
        'TYPE': 'Type',
        'Type': 'Type',
        'STATUS': 'Status',
        'Status': 'Status',
        'DESCRIPTION': 'Description',
        'Description': 'Description',
        'ADDRESS': 'Address',
        'Address': 'Address',
        'CITY': 'City',
        'City': 'City',
        'STATE': 'State',
        'State': 'State',
        'ZIP': 'ZIP Code',
        'ZIPCODE': 'ZIP Code',
        'ZIP_CODE': 'ZIP Code',
        'PHONE': 'Phone',
        'Phone': 'Phone',
        'EMAIL': 'Email',
        'Email': 'Email',
        'URL': 'Website',
        'WEBSITE': 'Website',
        'Website': 'Website',
        'TRACTCE20': 'Census Tract',
        'NAMELSAD20': 'Census Tract Name',
        'TOTALPOP': 'Total Population',
        'GEOID20': 'Geographic ID'
    };

    if (commonAliases[fieldName]) {
        return commonAliases[fieldName];
    }

    const lowerFieldName = fieldName.toLowerCase();
    const matchingKey = Object.keys(commonAliases).find(key => key.toLowerCase() === lowerFieldName);
    if (matchingKey) {
        return commonAliases[matchingKey];
    }

    return fieldName
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, l => l.toUpperCase());
}, [props.config?.featureLayers, state.layerFieldMetadata]);

    const formatFieldValue = React.useCallback((value: any, fieldName: string): string => {
    if (value === null || value === undefined) return '';

    if (fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('time')) {
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
        } catch (e) {
            // Fall through to default formatting
        }
    }

    if (typeof value === 'number') {
        if (fieldName.toLowerCase().includes('area')) {
            return value.toLocaleString() + ' sq units';
        } else if (fieldName.toLowerCase().includes('length') || fieldName.toLowerCase().includes('distance')) {
            return value.toLocaleString() + ' units';
        } else if (value % 1 !== 0) {
            return value.toFixed(2);
        } else {
            return value.toLocaleString();
        }
    }

    return String(value);
}, []);

    const handleContextMenuAction = React.useCallback((action: string) => {
    const { mapPoint } = state.contextMenu;
    const mapView = mapViewRef.current;

    if (!mapView || !mapPoint) {
        hideContextMenu();
        return;
    }

    switch (action) {
        case 'zoom-in':
            mapView.goTo({ target: mapPoint, zoom: mapView.zoom + 1 }).catch(() => { });
            break;
        case 'zoom-out':
            mapView.goTo({ target: mapPoint, zoom: mapView.zoom - 1 }).catch(() => { });
            break;
        case 'center-here':
            mapView.goTo({ target: mapPoint }).catch(() => { });
            break;
        case 'get-coordinates':
            copyCoordinates();
            break;
        case 'plot-coordinates':
            plotCoordinate();
            break;
        case 'plot-marker':
            plotSimpleMarker();
            break;
        // NEW: Add text action
        case 'add-text':
            showTextInputDialog();
            break;
        case 'clear-coordinates':
            clearCoordinateMarkers();
            break;
        case 'clear-markers':
            clearSimpleMarkers();
            break;
        case 'clear-text':
            clearTextGraphics();
            break;
        // UPDATED: Renamed from clear-all-markers to clear-all-graphics
        case 'clear-all-graphics':
            clearAllGraphics();
            break;
        case 'street-view':
            openStreetView();
            break;
        case 'pictometry':
            openPictometryView();
            break;
        case 'measure-distance':
            startMeasurement();
            break;
        case 'measure-area':
            startAreaMeasurement();
            break;
        case 'whats-here': {
            const handleWhatsHere = async () => {
                try {
                    let allResults: Array<{ layerName: string; features: any[]; layerUrl: string }> = [];

                    let addressText = '';
                    if (props.config?.reverseGeocodeUrl) {
                        const targetWkid = props.config.reverseGeocodeWkid ?? 4326;
                        let projectedPoint: __esri.Point;

                        try {
                            projectedPoint = await projectToSpatialReference(mapPoint, targetWkid);

                            const locatorModule = await new Promise((resolve) => {
                                (window as any).require(['esri/rest/locator'], (locator: any) => {
                                    resolve(locator);
                                });
                            });

                            const geocodeParams = {
                                location: projectedPoint,
                                distance: 1000,
                                outSR: projectedPoint.spatialReference,
                                returnIntersection: false,
                                locationType: 'rooftop' as const
                            };

                            const response = await (locatorModule as any).locationToAddress(props.config.reverseGeocodeUrl, geocodeParams);

                            addressText = response?.address ||
                                response?.attributes?.Match_addr ||
                                response?.attributes?.Address ||
                                response?.attributes?.StAddr ||
                                response?.attributes?.Street || '';

                            if (typeof addressText !== 'string') {
                                addressText = '';
                            }

                        } catch (error) {
                            console.warn('Geocoding failed:', error);
                            try {
                                if (!projectedPoint) {
                                    projectedPoint = await projectToSpatialReference(mapPoint, targetWkid);
                                }
                                if (targetWkid === 4326) {
                                    addressText = `${projectedPoint.y.toFixed(6)}, ${projectedPoint.x.toFixed(6)}`;
                                } else {
                                    addressText = `${projectedPoint.x.toFixed(2)}, ${projectedPoint.y.toFixed(2)}`;
                                }
                            } catch (projectionError) {
                                console.warn('Projection also failed:', projectionError);
                                addressText = `${mapPoint.x.toFixed(2)}, ${mapPoint.y.toFixed(2)}`;
                            }
                        }
                    }

                    // Query feature layers with improved error handling
                    if (props.config?.featureLayers?.length) {
                        const queryPromises = props.config.featureLayers.map(async (layer) => {
                            try {
                                return await queryFeatureLayer(layer, mapPoint);
                            } catch (error) {
                                return { layerName: layer.name, features: [], layerUrl: layer.url };
                            }
                        });
                        const results = await Promise.allSettled(queryPromises);
                        allResults = results
                            .filter((result): result is PromiseFulfilledResult<{ layerName: string; features: any[]; layerUrl: string }> =>
                                result.status === 'fulfilled' && result.value.features.length > 0
                            )
                            .map(result => result.value);
                    }

                    let popupContent = '';

                    popupContent += '<div style="font-family: \'Avenir Next\', \'Helvetica Neue\', Helvetica, Arial, sans-serif; color: #323232; line-height: 1.4; font-size: 13px; padding: 4px 0;">';

                    if (addressText) {
                        popupContent += `
                                <div style="
                                    display: flex;
                                    align-items: flex-start;
                                    margin-bottom: 12px;
                                    padding: 8px 0;
                                    border-bottom: 2px solid #0079c1;
                                ">
                                    <div style="
                                        font-weight: 600;
                                        color: #0079c1;
                                        white-space: nowrap;
                                        flex-shrink: 0;
                                        min-width: 120px;
                                        font-size: 13px;
                                    ">
                                        Location:
                                    </div>
                                    <div style="
                                        color: #323232;
                                        word-wrap: break-word;
                                        flex: 1;
                                        margin-left: 8px;
                                        font-size: 13px;
                                        font-weight: 500;
                                    ">
                                        ${addressText}
                                    </div>
                                </div>
                            `;
                    }

                    if (allResults.length > 0) {
                        popupContent += generatePopupContent(allResults);
                    }

                    if (!addressText && allResults.length === 0) {
                        popupContent += `
                                <div style="color: #6e6e6e; font-style: italic; text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 4px; margin: 10px 0;">
                                    No information found at this location.
                                </div>
                            `;
                    }

                    popupContent += '</div>';

                    mapView.openPopup({
                        title: "📍 What's here?",
                        content: `
                                <style>
                                    .esri-popup__main-container {
                                        min-width: 450px !important;
                                        max-width: 550px !important;
                                    }
                                    .esri-popup__content {
                                        min-width: 430px !important;
                                    }
                                    .esri-popup__header-title {
                                        font-size: 16px !important;
                                        font-weight: 600 !important;
                                    }
                                </style>
                                <div style="max-height: ${props.config?.uiSettings?.popupMaxHeight || 400}px; overflow-y: auto; min-width: 430px; padding: 4px;">
                                    ${popupContent}
                                </div>
                            `,
                        location: mapPoint
                    });

                } catch (error) {
                    console.error('Error in What\'s Here functionality:', error);
                    mapView.openPopup({
                        title: "📍 What's here?",
                        content: `
                                <div style="color: #d32f2f; padding: 16px; text-align: center;">
                                    <strong>Error occurred while querying location information.</strong><br/>
                                    <small style="color: #666;">Please check the console for more details.</small>
                                </div>
                            `,
                        location: mapPoint
                    });
                }
            };

            if (!props.config?.reverseGeocodeUrl && (!props.config?.featureLayers || props.config.featureLayers.length === 0)) {
                alert("What's Here functionality requires either a geocoding service URL or feature layers to be configured. Please check widget settings.");
                break;
            }

            handleWhatsHere();
            break;
        }
    }

    hideContextMenu();
}, [state.contextMenu, hideContextMenu, copyCoordinates, plotCoordinate, plotSimpleMarker, showTextInputDialog, clearCoordinateMarkers, clearSimpleMarkers, clearTextGraphics, clearAllGraphics, openStreetView, openPictometryView, startMeasurement, startAreaMeasurement, projectToSpatialReference, queryFeatureLayer, generatePopupContent, props.config, getFieldDisplayName]);

    const onActiveViewChange = React.useCallback((jmv: JimuMapView) => {
    if (jmv?.view) {
        const mapView = jmv.view as __esri.MapView;
        mapViewRef.current = mapView;

        mapView.when(() => {
            const container = mapView.container;

            mapView.on('pointer-down', async (event) => {
                if (event.button === 2) {
                    if (event.native) {
                        event.native.preventDefault?.();
                        event.native.stopImmediatePropagation?.();
                    }

                    event.stopPropagation();

                    setTimeout(async () => {
                        const mapPoint = mapView.toMap({ x: event.x, y: event.y });
                        let coordinateLabel: string;
                        const coordinateSystem = props.config?.coordinateSystem || 'map';

                        if (coordinateSystem === 'map') {
                            coordinateLabel = `${mapPoint.x.toFixed(2)}, ${mapPoint.y.toFixed(2)}`;
                        } else if (coordinateSystem === 'webMercator') {
                            try {
                                const latLonPoint = await projectToLatLon(mapPoint);
                                if (latLonPoint?.x !== undefined && latLonPoint?.y !== undefined &&
                                    Math.abs(latLonPoint.y) <= 90 && Math.abs(latLonPoint.x) <= 180) {
                                    coordinateLabel = `${latLonPoint.y.toFixed(6)}, ${latLonPoint.x.toFixed(6)}`;
                                } else {
                                    const manualLatLon = manualProjectToLatLon(mapPoint);
                                    coordinateLabel = `${manualLatLon.lat.toFixed(6)}, ${manualLatLon.lon.toFixed(6)}`;
                                }
                            } catch {
                                const manualLatLon = manualProjectToLatLon(mapPoint);
                                coordinateLabel = `${manualLatLon.lat.toFixed(6)}, ${manualLatLon.lon.toFixed(6)}`;
                            }
                        } else {
                            coordinateLabel = `${mapPoint.x.toFixed(2)}, ${mapPoint.y.toFixed(2)}`;
                        }

                        const rect = container.getBoundingClientRect();
                        let x = event.x + rect.left;
                        let y = event.y + rect.top;

                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;

                        const menuWidth = 200;
                        const menuHeight = 420; // Updated to accommodate new text menu item

                        if (x + menuWidth > viewportWidth) x -= menuWidth;
                        if (y + menuHeight > viewportHeight) y -= menuHeight;

                        x = Math.max(10, x);
                        y = Math.max(10, y);

                        setState(prevState => ({
                            ...prevState,
                            showingContextMenu: true,
                            contextMenu: {
                                visible: true,
                                x,
                                y,
                                mapPoint,
                                coordinateLabel
                            }
                        }));

                        setTimeout(() => {
                            setState(prevState => ({
                                ...prevState,
                                showingContextMenu: false
                            }));
                        }, 100);
                    }, 10);
                }
            });

            mapView.on('click', (event) => {
                if (event.button !== 2 && !state.showingContextMenu) {
                    hideContextMenu();
                }
            });

            mapView.on('drag', hideContextMenu);
        }).catch(() => { });
    }
}, [projectToLatLon, manualProjectToLatLon, hideContextMenu, props.config?.coordinateSystem, state.showingContextMenu]);

    const contextMenuStyle: React.CSSProperties = {
    position: 'fixed',
    top: state.contextMenu.y,
    left: state.contextMenu.x,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    zIndex: 1000,
    minWidth: '200px',
    display: state.contextMenu.visible ? 'block' : 'none'
};

    const menuItemStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #eee',
    fontSize: '14px'
};

    const MenuItem = React.memo(({ action, icon, text, enabled = true }: {
    action: string;
    icon: string;
    text: string;
    enabled?: boolean;
}) => (
    enabled ? (
        <div
            style={menuItemStyle}
            onClick={() => handleContextMenuAction(action)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            {icon} {text}
        </div>
    ) : null
));

    return (
        <div className="widget-right-click-map" style={{ width: '100%', height: '100%', position: 'relative' }}>
            {mapWidgetIds?.length > 0 ? (
                <JimuMapViewComponent
                    useMapWidgetId={mapWidgetIds[0]}
                    onActiveViewChange={onActiveViewChange}
                />
            ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p>Please configure this widget to use a Map widget.</p>
                    <p>Go to widget settings and select a map to connect to.</p>
                </div>
            )}

            <div id="context-menu" style={contextMenuStyle}>
                <MenuItem
                    action="zoom-in"
                    icon="🔍"
                    text="Zoom In"
                    enabled={props.config?.enabledActions?.zoomIn !== false}
                />
                <MenuItem
                    action="zoom-out"
                    icon="🔍"
                    text="Zoom Out"
                    enabled={props.config?.enabledActions?.zoomOut !== false}
                />
                <MenuItem
                    action="center-here"
                    icon="📍"
                    text="Center Here"
                    enabled={props.config?.enabledActions?.centerHere !== false}
                />
                <MenuItem
                    action="plot-marker"
                    icon="🔴"
                    text="Plot Marker"
                    enabled={props.config?.enabledActions?.plotMarker !== false}
                />
                {(props.config?.enabledActions?.copyCoordinates !== false) && state.contextMenu.coordinateLabel && (
                    <MenuItem
                        action="get-coordinates"
                        icon="📋"
                        text={`Copy Coordinates: ${state.contextMenu.coordinateLabel}`}
                    />
                )}
                <MenuItem
                    action="plot-coordinates"
                    icon="📌"
                    text="Plot Coordinate"
                    enabled={props.config?.enabledActions?.plotCoordinates !== false}
                />
                <MenuItem
                    action="add-text"
                    icon="🅰️"
                    text="Add Text"
                    enabled={props.config?.enabledActions?.addText !== false}
                />
                {/* Only show Clear All when there are any graphics to clear */}
                {(state.coordinateMarkers.length > 0 || state.simpleMarkers.length > 0 || state.textGraphics.length > 0) && (
                    <MenuItem
                        action="clear-all-graphics"
                        icon="🧹"
                        text={`Clear All Graphics (${state.coordinateMarkers.length + state.simpleMarkers.length + state.textGraphics.length})`}
                        enabled={(props.config?.enabledActions?.plotCoordinates !== false) || (props.config?.enabledActions?.plotMarker !== false) || (props.config?.enabledActions?.addText !== false)}
                    />
                )}
                <MenuItem
                    action="street-view"
                    icon="🗺️"
                    text="Open in Google Street View"
                    enabled={props.config?.enabledActions?.streetView !== false}
                />
                <MenuItem
                    action="pictometry"
                    icon="📷"
                    text="Open in Pictometry"
                    enabled={props.config?.enabledActions?.pictometry !== false && !!props.config?.pictometryUrl}
                />
                <MenuItem
                    action="measure-distance"
                    icon="📏"
                    text="Measure Distance"
                    enabled={props.config?.enabledActions?.measureDistance !== false}
                />
                <MenuItem
                    action="measure-area"
                    icon="📐"
                    text="Measure Area"
                    enabled={props.config?.enabledActions?.measureArea !== false}
                />
                {(props.config?.enabledActions?.whatsHere !== false) && (
                    <div
                        style={{ ...menuItemStyle, borderBottom: 'none' }}
                        onClick={() => handleContextMenuAction('whats-here')}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        ❓ What's here?
                    </div>
                )}
            </div>

            {/* NEW: Text input dialog */}
            {state.showTextDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'right'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '24px',
                        minWidth: '400px',
                        maxWidth: '500px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px',
                            paddingBottom: '12px',
                            borderBottom: '1px solid #e0e0e0'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                                🅰️ Enter Your Text
                            </h3>
                            <button
                                onClick={cancelTextInput}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#666',
                                    padding: '0',
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <p style={{
                            margin: '0 0 16px 0',
                            color: '#666',
                            fontSize: '14px',
                            lineHeight: '1.4'
                        }}>
                            Type the text you want to add at this location on the map.
                        </p>
                        <input
                            type="text"
                            placeholder="Example Text"
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #e0e0e0',
                                borderRadius: '4px',
                                fontSize: '14px',
                                marginBottom: '20px',
                                boxSizing: 'border-box'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement;
                                    if (target.value.trim()) {
                                        addTextToMap(target.value);
                                    }
                                } else if (e.key === 'Escape') {
                                    cancelTextInput();
                                }
                            }}
                        />
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                onClick={cancelTextInput}
                                style={{
                                    padding: '10px 20px',
                                    border: '2px solid #ccc',
                                    borderRadius: '4px',
                                    backgroundColor: 'white',
                                    color: '#666',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const input = document.querySelector('input[placeholder="Example Text"]') as HTMLInputElement;
                                    if (input && input.value.trim()) {
                                        addTextToMap(input.value);
                                    }
                                }}
                                style={{
                                    padding: '10px 20px',
                                    border: '2px solid #007ACC',
                                    borderRadius: '4px',
                                    backgroundColor: '#007ACC',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
    };

export default Widget; 