import type { JimuMapView } from 'jimu-arcgis'
import type Layer from 'esri/layers/Layer'
import { TreeItemActionType, type TreeItemType, type UpdateTreeActionDataType } from 'jimu-ui/basic/list-tree'


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

export const toLayerKey = (layerId: string | number): string => String(layerId)

const toLayerArray = (layerCollection: any): Layer[] => {
    if (!layerCollection) {
        return []
    }
    if (Array.isArray(layerCollection)) {
        return layerCollection as Layer[]
    }
    if (typeof layerCollection.toArray === 'function') {
        return layerCollection.toArray() as Layer[]
    }
    if (typeof layerCollection.forEach === 'function') {
        const collectionItems: Layer[] = []
        layerCollection.forEach((layer: Layer) => collectionItems.push(layer))
        return collectionItems
    }
    return []
}

export function buildLayerTreeRoot (
    layerList: Layer[] | null,
    selectedLayerIds: string[] = [],
    expandedItemKeys: string[] = [],
    rootItemKey: string = 'abls-layer-root',
    rootItemTitle: string = 'Layers'
): TreeItemType {
    const rootItem: TreeItemType = {
        itemKey: rootItemKey,
        itemStateTitle: rootItemTitle,
        itemChildren: []
    }

    if (!layerList?.length) {
        return rootItem
    }

    const selectedIds = new Set(selectedLayerIds.map((id) => toLayerKey(id)))
    const expandedIds = new Set(expandedItemKeys.map((id) => toLayerKey(id)))
    const treeItemById = new Map<string, TreeItemType>()
    const childIds = new Set<string>()

    layerList.forEach((layer) => {
        if (!layer?.id) {
            return
        }
        const layerKey = toLayerKey(layer.id)
        treeItemById.set(layerKey, {
            itemKey: layerKey,
            itemStateTitle: layer.title || layerKey,
            itemStateChecked: selectedIds.has(layerKey),
            itemStateExpanded: expandedIds.has(layerKey),
            itemChildren: []
        })
    })

    layerList.forEach((layer) => {
        if (!layer?.id) {
            return
        }
        const parentLayerKey = toLayerKey(layer.id)
        const parentItem = treeItemById.get(parentLayerKey)
        if (!parentItem) {
            return
        }

        const children = [
            ...toLayerArray((layer as any).layers),
            ...toLayerArray((layer as any).sublayers)
        ]
        const seenChildIds = new Set<string>()

        children.forEach((childLayer) => {
            const childId = childLayer?.id
            if (!childId || childId === layer.id) {
                return
            }
            const childLayerKey = toLayerKey(childId)
            if (seenChildIds.has(childLayerKey)) {
                return
            }
            const childItem = treeItemById.get(childLayerKey)
            if (!childItem) {
                return
            }

            seenChildIds.add(childLayerKey)
            parentItem.itemChildren = [...(parentItem.itemChildren ?? []), childItem]
            childIds.add(childLayerKey)
        })
    })

    const rootChildren = layerList
        .filter((layer) => layer?.id && !childIds.has(toLayerKey(layer.id)))
        .map((layer) => treeItemById.get(toLayerKey(layer.id)))
        .filter(Boolean)

    rootItem.itemChildren = rootChildren
    return rootItem
}

export type LayerTreeUpdateResult =
    | { kind: 'none' }
    | { kind: 'expand', layerId: string, expanded: boolean }
    | { kind: 'checkbox', layerId: string, checked: boolean }

export function parseLayerTreeUpdate (actionData: UpdateTreeActionDataType, rootItemKey: string = 'abls-layer-root'): LayerTreeUpdateResult {
    const currentItem = actionData?.currentItemJson ?? actionData?.itemJsons?.[0]

    if (actionData?.updateType === TreeItemActionType.HandleExpandItem) {
        const rawItemKey = actionData?.currentItemJson?.itemKey
        if (!rawItemKey || rawItemKey === rootItemKey) {
            return { kind: 'none' }
        }

        return {
            kind: 'expand',
            layerId: toLayerKey(rawItemKey),
            expanded: Boolean(actionData?.changeItemJson?.itemStateExpanded)
        }
    }

    if (actionData?.updateType === TreeItemActionType.HandleCheckboxChanged) {
        const changedItem = actionData?.itemJsons?.[0]
        const rawLayerId = currentItem?.itemKey ?? changedItem?.itemKey
        if (!rawLayerId || rawLayerId === rootItemKey) {
            return { kind: 'none' }
        }

        const checked = typeof actionData?.changeItemJson?.itemStateChecked === 'boolean'
            ? actionData.changeItemJson.itemStateChecked
            : typeof changedItem?.itemStateChecked === 'boolean'
                ? changedItem.itemStateChecked
                : Boolean(currentItem?.itemStateChecked)

        return {
            kind: 'checkbox',
            layerId: toLayerKey(rawLayerId),
            checked
        }
    }

    return { kind: 'none' }
}

export function updateExpandedKeysByViewId (
    previousState: { [viewId: string]: string[] },
    viewId: string,
    layerId: string,
    expanded: boolean
): { [viewId: string]: string[] } {
    const currentExpanded = previousState[viewId] ?? []
    if (expanded) {
        if (currentExpanded.includes(layerId)) {
            return previousState
        }
        return {
            ...previousState,
            [viewId]: [...currentExpanded, layerId]
        }
    }

    return {
        ...previousState,
        [viewId]: currentExpanded.filter((key) => key !== layerId)
    }
}