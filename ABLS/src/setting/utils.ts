import type { JimuMapView } from 'jimu-arcgis'
import type Layer from 'esri/layers/Layer'


export function getLayersFromJimuMapView (jimuMapView: JimuMapView): Layer[] {
    const layers: Layer[] = []
    const seenLayerKeys = new Set<string>()
    const seenLayerRefs = new WeakSet()

    const toLayerArray = (layerCollection: any): any[] => {
        if (!layerCollection) {
            return []
        }
        if (Array.isArray(layerCollection)) {
            return layerCollection
        }
        if (typeof layerCollection.toArray === 'function') {
            return layerCollection.toArray()
        }
        if (typeof layerCollection.forEach === 'function') {
            const collectionItems: any[] = []
            layerCollection.forEach((layer: any) => collectionItems.push(layer))
            return collectionItems
        }
        return []
    }

    const getLayerKey = (layer: any): string | null => {
        if (!layer) {
            return null
        }
        if (layer.uid != null) {
            return `uid:${String(layer.uid)}`
        }
        if (layer.id != null && layer.type != null) {
            return `type:${String(layer.type)}|id:${String(layer.id)}`
        }
        if (layer.id != null) {
            return `id:${String(layer.id)}`
        }
        return null
    }

    const collectLayers = (layerCollection: any): void => {
        toLayerArray(layerCollection).forEach((layer: any) => {
            const layerKey = getLayerKey(layer)
            const isSeenByKey = layerKey ? seenLayerKeys.has(layerKey) : false
            const isSeenByRef = layer && typeof layer === 'object' ? seenLayerRefs.has(layer) : false

            if (isSeenByKey || isSeenByRef) {
                return
            }

            if (layerKey) {
                seenLayerKeys.add(layerKey)
            }
            if (layer && typeof layer === 'object') {
                seenLayerRefs.add(layer)
            }

            layers.push(layer)

            if (layer.layers) {
                collectLayers(layer.layers)
            }
            if (layer.sublayers) {
                collectLayers(layer.sublayers)
            }
        })
    }

    // Follow the same map.layers-first approach used by new-radar, while still
    // traversing nested layers/sublayers for ABLS backward compatibility.
    const rootLayers = jimuMapView?.view?.map?.allLayers ?? jimuMapView?.view?.map?.layers
    collectLayers(rootLayers)

    return layers
}