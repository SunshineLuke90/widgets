import React, { useEffect, useRef, useState } from 'react';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-action-bar';
import '@esri/calcite-components/dist/components/calcite-slider';
import '@esri/calcite-components/dist/components/calcite-tooltip';
import { CalciteSlider } from '@esri/calcite-components-react';
import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-legend';

import Extent from "@arcgis/core/geometry/Extent.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer.js";
import WMSLayer from "@arcgis/core/layers/WMSLayer.js";
import esriRequest from "@arcgis/core/request";
import './style.css'
import MapView from 'esri/views/MapView';
import { MapViewManager } from 'jimu-arcgis';

// React wrapper component for the radar animation
export default function Radar({ mapElementId = 'radar-map' }) {
    let mounted = true;
    const wmsRef = useRef(null);
    const viewWatchHandleRef = useRef(null);
    const refreshTimerIdRef = useRef(null);
    const panZoomTimerRef = useRef(null);
    const prefetchInProgressRef = useRef(false);
    const prevExtentKeyRef = useRef(null);

    const [framesState, setFramesState] = useState([]);
    const framesRef = useRef([]);
    const [idxState, setIdxState] = useState(0);
    const idxRef = useRef(0);
    const [playSpeed, setPlaySpeed] = useState(3);
    const playSpeedRef = useRef(3);
    const [playing, setPlaying] = useState(false);
    const intervalRef = useRef(null);
    const sliderRef = useRef(null);
    const [statusText, setStatusText] = useState('Status: loading...');
    const [tsText, setTsText] = useState('—');
    const [timeType, setTimeType] = useState(false);
    const toggleTimeType = () => {
        setTimeType(!timeType);
    };
    const applyFrameRef = useRef(null);
    const startAnimationRef = useRef(null);
    const stopAnimationRef = useRef(null);
    const mvManager = MapViewManager.getInstance();
    const jimuMapView = mvManager.getJimuMapViewById(mvManager.getAllJimuMapViewIds()[0]);

    useEffect(() => {
        (async function init() {
            const view = (await jimuMapView.whenJimuMapViewLoaded()).view as __esri.MapView;

            setStatusText('Status: loading...');

            try {
                const wmsBase = 'https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows';
                const layerName = 'base_reflectivity_mosaic';

                const capsResp = await esriRequest(`${wmsBase}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`, { responseType: 'text' });
                const parser = new DOMParser();
                const xml = parser.parseFromString(capsResp.data, 'application/xml');
                const layers = xml.getElementsByTagNameNS('http://www.opengis.net/wms', 'Layer');
                let targetLayer = null;
                for (let i = 0; i < layers.length; i++) {
                    const nameNode = layers[i].getElementsByTagNameNS('http://www.opengis.net/wms', 'Name')[0];
                    if (nameNode && nameNode.textContent === layerName) { targetLayer = layers[i]; break; }
                }

                wmsRef.current = new WMSLayer({ url: wmsBase, title: 'nowCOAST Radar (WMS)', sublayers: [{ name: layerName }], opacity: 0.75, visible: true });
                view.map.add(wmsRef.current);
                setStatusText('Status: WMS layer added');

                // controls are rendered via React JSX/state (see component return)

                // parse times
                let times = [];
                if (targetLayer) {
                    const dims = targetLayer.getElementsByTagNameNS('http://www.opengis.net/wms', 'Dimension');
                    for (let i = 0; i < dims.length; i++) {
                        const dim = dims[i];
                        const name = dim.getAttribute('name');
                        if (name && name.toLowerCase() === 'time') {
                            const text = dim.textContent.trim();
                            if (text.indexOf(',') !== -1) times = text.split(',').map((s) => s.trim());
                            else times = [text];
                            break;
                        }
                    }
                    if (times.length === 0) {
                        const exts = targetLayer.getElementsByTagNameNS('http://www.opengis.net/wms', 'Extent');
                        for (let i = 0; i < exts.length; i++) {
                            const ext = exts[i];
                            const name = ext.getAttribute('name');
                            if (name && name.toLowerCase() === 'time') {
                                const text = ext.textContent.trim();
                                if (text.indexOf(',') !== -1) times = text.split(',').map((s) => s.trim());
                                else times = [text];
                                break;
                            }
                        }
                    }
                }

                if (!times || times.length === 0) {
                    console.debug('WMS capabilities did not include explicit times for layer; rendering latest available image.');
                    setStatusText('Status: WMS layer (latest) added');
                    return;
                }

                framesRef.current = times.slice(-30);
                setFramesState(framesRef.current);
                setStatusText(`Status: ${framesRef.current.length} time frames available`);

                // Service Worker + prefetch helpers
                const CACHE_NAME = 'radar-wms-v1';

                function buildGetMapUrl(time) {
                    try {
                        const extent = view.extent;
                        const bbox = [extent.xmin, extent.ymin, extent.xmax, extent.ymax].join(',');
                        const width = Math.max(256, view.width || 1024);
                        const height = Math.max(256, view.height || 1024);
                        const params = new URLSearchParams({ service: 'WMS', version: '1.3.0', request: 'GetMap', layers: layerName, styles: '', crs: 'EPSG:3857', bbox: bbox, width: String(width), height: String(height), format: 'image/png', transparent: 'TRUE', time: time });
                        return `${wmsBase}?${params.toString()}`;
                    } catch (err) {
                        console.debug('Failed to build GetMap URL for prefetch:', err);
                        return null;
                    }
                }

                async function prefetchFrames(frameList) {
                    if (!frameList || frameList.length === 0) return;
                    try {
                        const cache = await caches.open(CACHE_NAME);
                        setStatusText(`Status: caching ${frameList.length} frames...`);
                        let respArr = [];
                        for (let i = 0; i < frameList.length; i++) {
                            const url = buildGetMapUrl(frameList[i]);
                            if (!url) continue;
                            try {
                                respArr.push(fetch(url, { mode: 'cors', credentials: 'omit' }));
                            } catch (fetchErr) { console.debug('Prefetch failed for', url, fetchErr); }
                        }
                        await Promise.all(respArr);
                        setStatusText(`Status: ready`);
                    } catch (cacheErr) { console.debug('Caching frames failed:', cacheErr); }
                }

                async function registerAndPrefetch() {
                    if (!('serviceWorker' in navigator) || !('caches' in window)) {
                        console.debug('ServiceWorker or Cache API not available');
                        return;
                    }
                    try {
                        console.debug('Registering service worker...');
                        const scopeUrl = window.location.origin + window.location.pathname
                        const swUrl = new URL('sw-radar.js', scopeUrl).href;
                        await navigator.serviceWorker.register(swUrl, {scope: scopeUrl}); //{ scope: location.origin }
                        console.log('Service worker registered:', swUrl);
                    } catch (e) {
                        console.debug('Service worker registration failed:', e);
                    }
                    try {
                        await prefetchFrames(framesRef.current);
                    } catch (e) {
                        console.debug('Initial prefetch failed:', e);
                    }
                }

                // refresh times periodically
                async function refreshTimes() {
                    try {
                        const capsResp2 = await esriRequest(`${wmsBase}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`, { responseType: 'text' });
                        const parser2 = new DOMParser();
                        const xml2 = parser2.parseFromString(capsResp2.data, 'application/xml');
                        const layers2 = xml2.getElementsByTagNameNS('http://www.opengis.net/wms', 'Layer');
                        let targetLayer2 = null;
                        for (let i = 0; i < layers2.length; i++) { const nameNode = layers2[i].getElementsByTagNameNS('http://www.opengis.net/wms', 'Name')[0]; if (nameNode && nameNode.textContent === layerName) { targetLayer2 = layers2[i]; break; } }
                        let times2 = [];
                        if (targetLayer2) {
                            const dims2 = targetLayer2.getElementsByTagNameNS('http://www.opengis.net/wms', 'Dimension');
                            for (let i = 0; i < dims2.length; i++) { const dim = dims2[i]; const name = dim.getAttribute('name'); if (name && name.toLowerCase() === 'time') { const text = dim.textContent.trim(); if (text.indexOf(',') !== -1) times2 = text.split(',').map((s) => s.trim()); else times2 = [text]; break; } }
                            if (times2.length === 0) {
                                const exts2 = targetLayer2.getElementsByTagNameNS('http://www.opengis.net/wms', 'Extent');
                                for (let i = 0; i < exts2.length; i++) { const ext = exts2[i]; const name = ext.getAttribute('name'); if (name && name.toLowerCase() === 'time') { const text = ext.textContent.trim(); if (text.indexOf(',') !== -1) times2 = text.split(',').map((s) => s.trim()); else times2 = [text]; break; } }
                            }
                        }
                        if (!times2 || times2.length === 0) { console.debug('refreshTimes: no times found'); return; }
                        const newFrames = times2.slice(-30);
                        const newly = newFrames.filter(t => !framesRef.current.includes(t));
                        if (newly.length > 0) {
                            framesRef.current = newFrames;
                            setFramesState(framesRef.current);
                            if (sliderRef.current) sliderRef.current.max = String(Math.max(0, framesRef.current.length - 1));
                            if (idxRef.current >= framesRef.current.length || idxRef.current === Number(sliderRef.current?.max)) {
                                idxRef.current = framesRef.current.length - 1;
                                setIdxState(idxRef.current);
                                if (applyFrameRef.current) await applyFrameRef.current(idxRef.current);
                            }
                            setStatusText(`Status: ${framesRef.current.length} time frames available (updated)`);
                            await prefetchFrames(newly);
                        } else { console.debug('refreshTimes: no new frames'); }
                    } catch (err) { console.debug('refreshTimes failed:', err); }
                }

                // extent prefetching
                function getExtentKey() { try { const e = view.extent; if (!e) return ''; return [e.xmin, e.ymin, e.xmax, e.ymax, view.width || 0, view.height || 0].join(','); } catch (err) { return ''; } }
                function schedulePrefetchForCurrentExtent(delay = 500) {
                    if (panZoomTimerRef.current) clearTimeout(panZoomTimerRef.current);
                    panZoomTimerRef.current = setTimeout(async () => {
                        if (prefetchInProgressRef.current) {
                            console.debug('Prefetch already in progress, skipping');
                            return;
                        }
                        const key = getExtentKey();
                        if (!key) return;
                        if (key === prevExtentKeyRef.current) {
                            console.debug('Extent unchanged, skipping prefetch');
                            return;
                        }
                        prevExtentKeyRef.current = key;
                        try {
                            prefetchInProgressRef.current = true;
                            setStatusText('Status: prefetching frames for new extent...');
                            await prefetchFrames(framesRef.current);
                            setStatusText(`Status: ready`);
                        } catch (err) {
                            console.debug('Extent prefetch failed:', err);
                        } finally {
                            prefetchInProgressRef.current = false;
                        }
                    }, delay);
                }

                // note: replace statusEl text updates above with setStatusText where used

                try {
                    viewWatchHandleRef.current = view.watch('stationary', (isStationary) => { if (!isStationary) return; schedulePrefetchForCurrentExtent(600); });
                } catch (e) {
                    if (view.on) {
                        try {
                            view.on('stationary', () => schedulePrefetchForCurrentExtent(600));
                        } catch (err) { }
                    }
                }

                // wire animation using React refs/state
                if (framesRef.current && framesRef.current.length) {
                    if (sliderRef.current) {
                        sliderRef.current.max = String(Math.max(0, framesRef.current.length - 1));
                        sliderRef.current.value = String(framesRef.current.length - 1);
                    }
                    idxRef.current = framesRef.current.length - 1;
                    setIdxState(idxRef.current);
                }

                async function applyFrame(i) {
                    if (!framesRef.current || framesRef.current.length === 0) return;
                    const t = framesRef.current[i];
                    try {
                        if (wmsRef.current && typeof wmsRef.current.setCustomParameters === 'function') wmsRef.current.setCustomParameters({ TIME: t });
                        else if (wmsRef.current) wmsRef.current.customParameters = { TIME: t };
                    } catch (e) {
                        console.debug('Failed to set WMS TIME parameter:', e);
                    }
                    try {
                        if (wmsRef.current && typeof wmsRef.current.refresh === 'function') wmsRef.current.refresh();
                    } catch (e) {
                        console.debug('WMS refresh failed:', e);
                    }
                    idxRef.current = i;
                    setIdxState(i);
                    setTsText(t);
                    if (sliderRef.current) {
                        sliderRef.current.value = String(i);
                    }
                }

                // expose functions to refs for JSX handlers
                applyFrameRef.current = applyFrame;

                function startAnimation() {
                    if (intervalRef.current) return;
                    setPlaying(true);
                    intervalRef.current = setInterval(() => { idxRef.current = (idxRef.current + 1) % framesRef.current.length; if (applyFrameRef.current) applyFrameRef.current(idxRef.current); }, playSpeedRef.current * 100);
                }

                function stopAnimation() {
                    if (!intervalRef.current) return;
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    setPlaying(false);
                }

                startAnimationRef.current = startAnimation;
                stopAnimationRef.current = stopAnimation;

                // handlers for React-controlled UI will call these functions
                // Wait until the view and the WMS layer view are fully ready before prefetching.
                async function waitForViewAndLayerReady(timeout = 15000) {
                    const start = Date.now();
                    try {
                        // wait for the view to be ready
                        if (view && typeof view.when === 'function') await view.when();

                        // ensure view has a non-zero size and an extent (for building GetMap bbox/px)
                        while ((!view || !view.extent || (view.width === 0 && view.height === 0)) && (Date.now() - start) < timeout) {
                            // eslint-disable-next-line no-await-in-loop
                            await new Promise((r) => setTimeout(r, 200));
                        }
                    } catch (e) {
                        console.debug('waitForViewAndLayerReady error:', e);
                    }
                }

                // initial register/prefetch and periodic refresh (but only after the view/layer have settled)
                (async () => {
                    await waitForViewAndLayerReady();
                    try { await registerAndPrefetch(); } catch (e) { console.debug('registerAndPrefetch failed after wait:', e); }
                })();
                refreshTimerIdRef.current = setInterval(refreshTimes, 4 * 60 * 1000);

            } catch (err) {
                console.error('Error creating WMS layer from nowCOAST:', err);
                setStatusText('Status: WMS layer error or not accessible');
                try {
                    const nowcoastUrl = 'https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer';
                    const nowLayer = new MapImageLayer({ url: nowcoastUrl, id: 'nowcoast-radar', opacity: 0.75, visible: true });
                    if (view && view.map) view.map.add(nowLayer);
                    setStatusText('Status: nowCOAST MapImageLayer added as fallback');
                } catch (e) { console.error('Fallback MapImageLayer failed:', e); }
            }
        })();

        // cleanup on unmount
        return () => {
            mounted = false;
            try {
                if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
                if (refreshTimerIdRef.current) { clearInterval(refreshTimerIdRef.current); refreshTimerIdRef.current = null; }
                if (panZoomTimerRef.current) { clearTimeout(panZoomTimerRef.current); panZoomTimerRef.current = null; }
                if (viewWatchHandleRef.current && viewWatchHandleRef.current.remove) viewWatchHandleRef.current.remove();
            } catch (e) { /* ignore */ }
        };
    }, [mapElementId]);

    // JSX UI for controls (React-managed)
    return (
        <div className="radar-panel">
            <div className="timeline-container">
                <calcite-button id="timestamp" className='timestamp' kind="neutral" appearance="transparent" round onClick={toggleTimeType}>{(() => {
                    if (tsText === '—') return tsText;
                    const dt = new Date(tsText);
                    const now = Date.now();
                    if (timeType) {
                        return (Math.round((now - dt.getTime()) / (1000 * 60)) + " minutes ago"); //for minutes differential
                    } else {
                        return (dt.toLocaleString()); //for localized timestamp of frame
                    }
                }
                )()}</calcite-button>
                <calcite-tooltip referenceElement="timestamp" placement="top">
                    <span>Toggle Time Format</span>
                </calcite-tooltip>
                <CalciteSlider
                    className="timeline-slider"
                    ref={sliderRef}
                    min={0}
                    max={Math.max(0, framesState.length - 1)}
                    value={idxState}
                    onCalciteSliderInput={
                        async (e) => {
                            const val = Number(e.target.value);
                            idxRef.current = val;
                            setIdxState(val);
                            applyFrameRef.current && await applyFrameRef.current(val);
                            stopAnimationRef.current && stopAnimationRef.current();
                        }}
                />
            </div>
            <div className="control-row">
                <div className="radar-play-pause">
                    <calcite-button width="full" size="l" appearance={playing ? "outline" : "solid"} round onClick={() => { if (playing) { stopAnimationRef.current && stopAnimationRef.current(); } else { startAnimationRef.current && startAnimationRef.current(); } }}>{playing ? 'Pause' : 'Play'}</calcite-button>
                </div>
                <div className="speed-container">
                    <div className="speed-label" style={{ fontSize: 'small', paddingTop: '4px' }}>Play Speed</div>
                    <CalciteSlider
                        className="speed-slider"
                        value={playSpeed}
                        mirrored fill-placement="end"
                        max={5} max-label="Play Speed: Upper Bound"
                        min={1} min-label="Play Speed: Lower Bound"
                        step={1} ticks={1} snap
                        onCalciteSliderInput={
                            (e) => {
                                setPlaySpeed(e.target.value as number);
                                playSpeedRef.current = e.target.value as number;
                                if (intervalRef.current == null) {
                                    return;
                                }
                                clearInterval(intervalRef.current);
                                intervalRef.current = setInterval(() => { idxRef.current = (idxRef.current + 1) % framesRef.current.length; if (applyFrameRef.current) applyFrameRef.current(idxRef.current); }, Number(e.target.value) * 100, 100);
                            }
                        }
                    />

                </div>
            </div>
            <div className='radar-status'>{statusText}</div>
        </div>
    );
}
