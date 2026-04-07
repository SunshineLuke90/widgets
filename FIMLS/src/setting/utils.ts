import type { JimuMapView } from 'jimu-arcgis'
import type Layer from 'esri/layers/Layer'


export function getLayersFromJimuMapView (jimuMapView: JimuMapView): Layer[] {
		const layers: Layer[] = []
		const collectLayers = (layerCollection: { forEach: (callback: (layer: any) => void) => void }) => {
				layerCollection.forEach((layer: any) => {
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