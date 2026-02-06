import type { JimuMapView } from 'jimu-arcgis'


export function getLayersFromJimuMapView(jimuMapView: JimuMapView): __esri.Layer[] {
    const layers = []
    const collectLayers = (layerCollection) => {
        layerCollection.forEach(layer => {
            layers.push(layer)
            if (layer.layers) {
                collectLayers(layer.layers)
            }
            if (layer.sublayers) {
                collectLayers(layer.sublayers)
            }
        })
    }
    if (jimuMapView?.view?.map?.allLayers) {
        collectLayers(jimuMapView.view.map.allLayers)
    }
    return layers
}