import {
  DataSourceComponent,
  Immutable,
  React,
  type AllWidgetProps,
  type DataSource,
  type FeatureLayerQueryParams
} from 'jimu-core'
import { Paper } from 'jimu-ui'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import Graphic from '@arcgis/core/Graphic.js'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js'
import Point from '@arcgis/core/geometry/Point.js'
import Multipoint from '@arcgis/core/geometry/Multipoint.js'
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine.js'
import JSZip from 'jszip'
import type { IMConfig, PhotoFieldMapping } from '../config'
import 'calcite-components'

type PhotoStatus = 'ready' | 'warning' | 'uploaded' | 'error' | 'skipped'

interface ParsedPhoto {
  id: string
  dedupeKey: string
  fileName: string
  file: File
  latitude: number | null
  longitude: number | null
  timestampIso: string
  fileCreatedIso: string
  orientation: number | null
  orientationLabel: string | null
  issues: string[]
  status: PhotoStatus
}

interface ExifMetadata {
  latitude: number | null
  longitude: number | null
  timestamp: string | null
  orientation: number | null
}

interface OrientationLabels {
  [key: number]: string
}

interface StringById {
  [key: string]: string
}

interface AttributesByField {
  [key: string]: unknown
}

interface PhotoResultById {
  [key: string]: {
    status: PhotoStatus
    issues: string[]
  }
}

interface UploadSummary {
  uploaded: number
  warning: number
  failed: number
  skippedNoGps: number
  skippedAlreadyUploaded: number
}

interface UploadOutcome {
  status: PhotoStatus
  issues: string[]
}

interface UploadLayerInfo {
  layer: FeatureLayer
  supportsAttachments: boolean
}

interface ParsedBatchResult {
  photos: ParsedPhoto[]
  unsupportedCount: number
}

interface BinaryPhotoInput {
  fileName: string
  buffer: ArrayBuffer
  lastModified: number
}

type AlertKind = 'info' | 'success' | 'warning'

interface RuntimeAlert {
  id: number
  message: string
  kind: AlertKind
}

const INITIAL_PROMPT = 'Upload a zip file or select individual photos to begin.'

const STATUS_COLORS: { [key in PhotoStatus]: AlertKind } = {
  ready: 'info',
  warning: 'warning',
  uploaded: 'success',
  error: 'warning',
  skipped: 'info'
}

const ORIENTATION_LABELS: OrientationLabels = {
  1: 'Top-left (normal)',
  2: 'Top-right (mirrored)',
  3: 'Bottom-right (rotated 180)',
  4: 'Bottom-left (mirrored)',
  5: 'Left-top (mirrored)',
  6: 'Right-top (rotated 90 CW)',
  7: 'Right-bottom (mirrored)',
  8: 'Left-bottom (rotated 90 CCW)'
}

let photoIdSequence = 0
const nextPhotoId = (): string => {
  photoIdSequence += 1
  return `photo-${Date.now()}-${photoIdSequence}`
}

const isImageFileName = (name: string): boolean => {
  return /\.(jpe?g|png|tif?f|heic|heif|webp|gif|bmp)$/i.test(name)
}

const isZipFile = (file: File): boolean => {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip'
}

const isExifCapableFileName = (name: string): boolean => {
  return /\.(jpe?g|tif?f)$/i.test(name)
}

const toMimeType = (name: string): string => {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff'
  if (lower.endsWith('.heic')) return 'image/heic'
  if (lower.endsWith('.heif')) return 'image/heif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/jpeg'
}

const normalizeExifTimestamp = (value: string | null): string | null => {
  if (!value) return null
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})/
  )
  if (!match) return null

  const [, y, mon, d, h, min, s] = match
  const iso = `${y}-${mon}-${d}T${h}:${min}:${s}Z`
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toISOString()
}

const readAscii = (view: DataView, offset: number, length: number): string => {
  if (length <= 0 || offset < 0 || offset + length > view.byteLength) return ''
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length)
  return new TextDecoder().decode(bytes).split('\u0000')[0]
}

const getTypeSize = (type: number): number => {
  switch (type) {
    case 1: return 1
    case 2: return 1
    case 3: return 2
    case 4: return 4
    case 5: return 8
    default: return 0
  }
}

const readRational = (
  view: DataView,
  offset: number,
  littleEndian: boolean
): number | null => {
  if (offset + 8 > view.byteLength) return null
  const numerator = view.getUint32(offset, littleEndian)
  const denominator = view.getUint32(offset + 4, littleEndian)
  if (denominator === 0) return null
  return numerator / denominator
}

const readIfdEntries = (
  view: DataView,
  ifdOffset: number,
  tiffOffset: number,
  littleEndian: boolean
): Map<number, { type: number, count: number, valueOffset: number }> => {
  const tags = new Map<number, { type: number, count: number, valueOffset: number }>()
  if (ifdOffset <= 0 || ifdOffset + 2 > view.byteLength) return tags

  const count = view.getUint16(ifdOffset, littleEndian)
  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    const tag = view.getUint16(entryOffset, littleEndian)
    const type = view.getUint16(entryOffset + 2, littleEndian)
    const valueCount = view.getUint32(entryOffset + 4, littleEndian)
    const byteLength = getTypeSize(type) * valueCount
    const rawOffset = view.getUint32(entryOffset + 8, littleEndian)
    const valueOffset = byteLength <= 4 ? entryOffset + 8 : tiffOffset + rawOffset
    tags.set(tag, { type, count: valueCount, valueOffset })
  }
  return tags
}

const readTagValue = (
  view: DataView,
  tag: { type: number, count: number, valueOffset: number },
  littleEndian: boolean
): string | number | number[] | null => {
  if (tag.valueOffset < 0 || tag.valueOffset >= view.byteLength) return null
  switch (tag.type) {
    case 2:
      return readAscii(view, tag.valueOffset, tag.count)
    case 3:
      if (tag.count === 1 && tag.valueOffset + 2 <= view.byteLength) {
        return view.getUint16(tag.valueOffset, littleEndian)
      }
      return null
    case 4:
      if (tag.count === 1 && tag.valueOffset + 4 <= view.byteLength) {
        return view.getUint32(tag.valueOffset, littleEndian)
      }
      return null
    case 5: {
      const values: number[] = []
      for (let i = 0; i < tag.count; i++) {
        const rationalOffset = tag.valueOffset + i * 8
        const value = readRational(view, rationalOffset, littleEndian)
        if (value === null) return null
        values.push(value)
      }
      return values
    }
    default:
      return null
  }
}

const dmsToDecimal = (
  values: number[] | null,
  hemisphereRef: string | null
): number | null => {
  if (!values || values.length < 3 || !hemisphereRef) return null
  const decimal = values[0] + values[1] / 60 + values[2] / 3600
  const upper = hemisphereRef.toUpperCase()
  if (upper === 'S' || upper === 'W') return decimal * -1
  return decimal
}

const parseExifMetadata = (bytes: Uint8Array): ExifMetadata => {
  const emptyMetadata: ExifMetadata = {
    latitude: null,
    longitude: null,
    timestamp: null,
    orientation: null
  }

  if (bytes.byteLength < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return emptyMetadata
  }

  let offset = 2
  let exifStart = -1

  while (offset + 4 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1]
    const segmentLength = (bytes[offset + 2] << 8) + bytes[offset + 3]
    if (marker === 0xe1 && segmentLength > 8) {
      const headerBytes = bytes.slice(offset + 4, offset + 10)
      const header = new TextDecoder().decode(headerBytes)
      if (header === 'Exif\u0000\u0000') {
        exifStart = offset + 10
        break
      }
    }
    offset += segmentLength + 2
  }

  if (exifStart < 0 || exifStart + 8 > bytes.byteLength) return emptyMetadata

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const endianMarker = view.getUint16(exifStart, false)
  const littleEndian = endianMarker === 0x4949
  const bigEndian = endianMarker === 0x4d4d
  if (!littleEndian && !bigEndian) return emptyMetadata

  const magic = view.getUint16(exifStart + 2, littleEndian)
  if (magic !== 42) return emptyMetadata

  const firstIfdOffset = exifStart + view.getUint32(exifStart + 4, littleEndian)
  const ifd0 = readIfdEntries(view, firstIfdOffset, exifStart, littleEndian)

  const orientationTag = ifd0.get(0x0112)
  const gpsIfdPointerTag = ifd0.get(0x8825)
  const exifIfdPointerTag = ifd0.get(0x8769)

  const orientation =
    orientationTag
      ? (readTagValue(view, orientationTag, littleEndian) as number | null)
      : null

  let timestamp: string | null = null
  if (exifIfdPointerTag) {
    const exifPointer = readTagValue(view, exifIfdPointerTag, littleEndian) as number | null
    if (typeof exifPointer === 'number') {
      const exifIfdOffset = exifStart + exifPointer
      const exifIfdTags = readIfdEntries(view, exifIfdOffset, exifStart, littleEndian)
      const dateTimeOriginalTag = exifIfdTags.get(0x9003)
      if (dateTimeOriginalTag) {
        const rawDate = readTagValue(view, dateTimeOriginalTag, littleEndian) as string | null
        timestamp = normalizeExifTimestamp(rawDate)
      }
    }
  }

  let latitude: number | null = null
  let longitude: number | null = null

  if (gpsIfdPointerTag) {
    const gpsPointer = readTagValue(view, gpsIfdPointerTag, littleEndian) as number | null
    if (typeof gpsPointer === 'number') {
      const gpsIfdOffset = exifStart + gpsPointer
      const gpsTags = readIfdEntries(view, gpsIfdOffset, exifStart, littleEndian)
      const latRefTag = gpsTags.get(0x0001)
      const latTag = gpsTags.get(0x0002)
      const lonRefTag = gpsTags.get(0x0003)
      const lonTag = gpsTags.get(0x0004)

      const latRef = latRefTag
        ? (readTagValue(view, latRefTag, littleEndian) as string | null)
        : null
      const latValues = latTag
        ? (readTagValue(view, latTag, littleEndian) as number[] | null)
        : null
      const lonRef = lonRefTag
        ? (readTagValue(view, lonRefTag, littleEndian) as string | null)
        : null
      const lonValues = lonTag
        ? (readTagValue(view, lonTag, littleEndian) as number[] | null)
        : null

      latitude = dmsToDecimal(latValues, latRef)
      longitude = dmsToDecimal(lonValues, lonRef)
    }
  }

  return { latitude, longitude, timestamp, orientation }
}

const appendUniqueIssue = (issues: string[], issue: string): string[] => {
  if (!issues.includes(issue)) {
    return [...issues, issue]
  }
  return issues
}

const getMutableFieldMappings = (config: IMConfig): PhotoFieldMapping[] => {
  const source: any = config?.fieldMappings ?? []
  if (typeof source.asMutable === 'function') {
    return source.asMutable({ deep: true })
  }
  return [...(source as PhotoFieldMapping[])]
}

const getPhotoFieldValue = (
  mapping: PhotoFieldMapping,
  photo: ParsedPhoto
): string | number | null => {
  switch (mapping.source) {
    case 'constant':
      return mapping.constantValue ?? null
    case 'fileName':
      return photo.fileName
    case 'fileCreated':
      return photo.fileCreatedIso
    case 'photoTimestamp':
      return photo.timestampIso
    case 'orientation':
      return photo.orientationLabel ?? photo.orientation
    case 'latitude':
      return photo.latitude
    case 'longitude':
      return photo.longitude
  }
}

const parseBinaryPhotoInput = (input: BinaryPhotoInput): ParsedPhoto => {
  const issues: string[] = []
  const bytes = new Uint8Array(input.buffer)
  const exifMetadata = isExifCapableFileName(input.fileName)
    ? parseExifMetadata(bytes)
    : {
      latitude: null,
      longitude: null,
      timestamp: null,
      orientation: null
    }

  const fileCreatedIso = new Date(input.lastModified).toISOString()
  const timestampIso = exifMetadata.timestamp ?? fileCreatedIso

  if (!isExifCapableFileName(input.fileName)) {
    issues.push('Limited metadata support for this file type. GPS and orientation may be unavailable.')
  }
  if (exifMetadata.latitude === null || exifMetadata.longitude === null) {
    issues.push('No GPS metadata found. This file will be skipped during upload.')
  }
  if (!exifMetadata.timestamp) {
    issues.push('EXIF timestamp missing. Using file creation timestamp (ISO).')
  }
  if (exifMetadata.orientation === null) {
    issues.push('No orientation metadata found.')
  }

  const orientationLabel =
    exifMetadata.orientation !== null
      ? (ORIENTATION_LABELS[exifMetadata.orientation] ?? `Orientation ${exifMetadata.orientation}`)
      : null

  const file = new File([input.buffer], input.fileName, {
    type: toMimeType(input.fileName),
    lastModified: input.lastModified
  })

  return {
    id: nextPhotoId(),
    dedupeKey: `${input.fileName}|${input.lastModified}|${input.buffer.byteLength}`,
    fileName: input.fileName,
    file,
    latitude: exifMetadata.latitude,
    longitude: exifMetadata.longitude,
    timestampIso,
    fileCreatedIso,
    orientation: exifMetadata.orientation,
    orientationLabel,
    issues,
    status: issues.length > 0 ? 'warning' : 'ready'
  }
}

export default function Widget (props: AllWidgetProps<IMConfig>) {
  const { config } = props
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const [targetDataSource, setTargetDataSource] = React.useState<DataSource>(null)
  const [photos, setPhotos] = React.useState<ParsedPhoto[]>([])
  const [isBusy, setIsBusy] = React.useState(false)
  const [isPreviewActive, setIsPreviewActive] = React.useState(false)
  const [isNarrowHeader, setIsNarrowHeader] = React.useState(false)
  const [runtimeAlert, setRuntimeAlert] = React.useState<RuntimeAlert>(null)
  const [userFieldValues, setUserFieldValues] = React.useState<StringById>({})

  const widgetRootRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewLayerRef = React.useRef<GraphicsLayer>(null)
  const alertIdRef = React.useRef(0)

  const fieldMappings = React.useMemo(
    () => getMutableFieldMappings(config),
    [config]
  )

  const editableMappings = React.useMemo(
    () => fieldMappings.filter((mapping) => mapping.exposeToUser && mapping.fieldName),
    [fieldMappings]
  )

  const showMessage = (
    nextMessage: string,
    type: AlertKind = 'info'
  ) => {
    alertIdRef.current += 1
    setRuntimeAlert({
      id: alertIdRef.current,
      message: nextMessage,
      kind: type
    })
  }

  React.useEffect(() => {
    const updateNarrowHeader = () => {
      const width = widgetRootRef.current?.clientWidth ?? 0
      setIsNarrowHeader(width > 0 && width < 350)
    }

    updateNarrowHeader()

    const rootElement = widgetRootRef.current
    if (!rootElement) return

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateNarrowHeader()
      })
      observer.observe(rootElement)
      return () => {
        observer.disconnect()
      }
    }

    window.addEventListener('resize', updateNarrowHeader)
    return () => {
      window.removeEventListener('resize', updateNarrowHeader)
    }
  }, [])

  React.useEffect(() => {
    if (editableMappings.length === 0) {
      setUserFieldValues({})
      return
    }

    setUserFieldValues((current) => {
      const next = { ...current }
      let changed = false
      for (const mapping of editableMappings) {
        if (next[mapping.id] === undefined) {
          next[mapping.id] = mapping.constantValue ?? ''
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [editableMappings])

  const clearMapPreview = React.useCallback(() => {
    previewLayerRef.current?.removeAll()
    setIsPreviewActive(false)
  }, [])

  React.useEffect(() => {
    return () => {
      if (jimuMapView?.view?.map && previewLayerRef.current) {
        jimuMapView.view.map.remove(previewLayerRef.current)
      }
    }
  }, [jimuMapView])

  const ensurePreviewLayer = React.useCallback((): GraphicsLayer | null => {
    if (!jimuMapView?.view?.map) return null
    if (!previewLayerRef.current) {
      previewLayerRef.current = new GraphicsLayer({
        title: 'Photo Dump Preview',
        listMode: 'hide'
      })
      jimuMapView.view.map.add(previewLayerRef.current)
    }
    return previewLayerRef.current
  }, [jimuMapView])

  const appendParsedPhotos = (incoming: ParsedPhoto[], sourceLabel: string, unsupportedCount = 0) => {
    if (incoming.length === 0) {
      showMessage(`No supported image files were found in ${sourceLabel}.`, 'warning')
      return
    }

    setPhotos((current) => {
      const existing = new Set(current.map((photo) => photo.dedupeKey))
      const filtered = incoming.filter((photo) => !existing.has(photo.dedupeKey))
      if (filtered.length === 0) return current
      return [...current, ...filtered]
    })

    const noGpsCount = incoming.filter(
      (photo) => photo.latitude === null || photo.longitude === null
    ).length

    const unsupportedText = unsupportedCount > 0
      ? ` ${unsupportedCount} unsupported files were ignored.`
      : ''

    showMessage(
      `Loaded ${incoming.length} photos from ${sourceLabel}. ${noGpsCount > 0 ? `${noGpsCount} have no GPS and will be skipped on upload.` : ''}${unsupportedText}`,
      noGpsCount > 0 ? 'info' : 'success'
    )
  }

  const parseZipUpload = async (zipFile: File): Promise<ParsedBatchResult> => {
    const zip = await JSZip.loadAsync(zipFile)
    const allEntries = Object.values(zip.files).filter((entry) => !entry.dir)
    const imageEntries = allEntries.filter((entry) => isImageFileName(entry.name))

    const parsedPhotos: ParsedPhoto[] = []
    for (const entry of imageEntries) {
      const fileName = entry.name.split('/').pop() || entry.name
      const buffer = await entry.async('arraybuffer')
      const lastModified = entry.date?.getTime() || Date.now()
      parsedPhotos.push(parseBinaryPhotoInput({ fileName, buffer, lastModified }))
    }

    return {
      photos: parsedPhotos,
      unsupportedCount: allEntries.length - imageEntries.length
    }
  }

  const parseSelectedFiles = async (fileList: FileList): Promise<ParsedBatchResult> => {
    const allFiles = Array.from(fileList)
    const imageFiles = allFiles.filter((file) => isImageFileName(file.name))

    const parsedPhotos: ParsedPhoto[] = []
    for (const file of imageFiles) {
      const buffer = await file.arrayBuffer()
      parsedPhotos.push(parseBinaryPhotoInput({
        fileName: file.name,
        buffer,
        lastModified: file.lastModified || Date.now()
      }))
    }

    return {
      photos: parsedPhotos,
      unsupportedCount: allFiles.length - imageFiles.length
    }
  }

  const handleFileSelectionChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    const selected = Array.from(selectedFiles)
    const selectedZipFiles = selected.filter((file) => isZipFile(file))

    setIsBusy(true)
    clearMapPreview()

    try {
      if (selectedZipFiles.length > 0) {
        if (selected.length !== 1) {
          showMessage('Select either one zip file or one or more image files.', 'warning')
          return
        }

        const parsed = await parseZipUpload(selectedZipFiles[0])
        appendParsedPhotos(parsed.photos, 'zip archive', parsed.unsupportedCount)
        return
      }

      const parsed = await parseSelectedFiles(selectedFiles)
      appendParsedPhotos(parsed.photos, 'individual file selection', parsed.unsupportedCount)
    } catch (error) {
      console.error(error)
      showMessage('Failed to parse selected files.', 'warning')
    } finally {
      setIsBusy(false)
      event.target.value = ''
    }
  }

  const buildAttributesForPhoto = React.useCallback(
    (photo: ParsedPhoto): AttributesByField => {
      const attributes: AttributesByField = {}

      for (const mapping of fieldMappings) {
        const fieldName = mapping.fieldName?.trim()
        if (!fieldName) continue

        let value = getPhotoFieldValue(mapping, photo)
        if (config?.allowUserOverrides && mapping.exposeToUser) {
          const overrideValue = userFieldValues[mapping.id]
          if (overrideValue !== undefined && overrideValue !== '') {
            value = overrideValue
          }
        }

        if (value !== undefined && value !== null && value !== '') {
          attributes[fieldName] = value
        }
      }

      return attributes
    },
    [config?.allowUserOverrides, fieldMappings, userFieldValues]
  )

  const showPhotosOnMap = async () => {
    const mapLayer = ensurePreviewLayer()
    if (!mapLayer) {
      showMessage('Map preview requires a connected map widget.', 'warning')
      return
    }

    const mappable = photos.filter(
      (photo) => photo.latitude !== null && photo.longitude !== null
    )
    if (mappable.length === 0) {
      showMessage('No photos with GPS coordinates are available to preview.', 'warning')
      return
    }

    mapLayer.removeAll()

    const graphics = mappable.map((photo) =>
      new Graphic({
        geometry: new Point({
          longitude: photo.longitude,
          latitude: photo.latitude,
          spatialReference: { wkid: 4326 }
        }),
        attributes: {
          fileName: photo.fileName,
          timestamp: photo.timestampIso
        },
        symbol: {
          type: 'simple-marker',
          style: 'circle',
          color: [0, 113, 255, 0.85],
          outline: {
            color: [255, 255, 255, 0.95],
            width: 1
          },
          size: 9
        } as any,
        popupTemplate: {
          title: '{fileName}',
          content: 'Timestamp: {timestamp}'
        }
      })
    )

    mapLayer.addMany(graphics)
    setIsPreviewActive(true)

    if (jimuMapView?.view) {
      try {
        const multipoint = new Multipoint({
          points: mappable.map((photo) => [photo.longitude, photo.latitude]),
          spatialReference: { wkid: 4326 }
        })

        const buffered = geometryEngine.geodesicBuffer(multipoint, 500, 'meters')
        const target = Array.isArray(buffered)
          ? buffered[0]?.extent
          : buffered?.extent

        await jimuMapView.view.goTo(target ?? graphics)
      } catch (error) {
        console.warn('Unable to zoom to photo preview extent.', error)
      }
    }

    showMessage(`Added ${graphics.length} preview points to the map.`, 'success')
  }

  const getTargetLayerUrl = (): string | null => {
    const dsJson = (targetDataSource as any)?.getDataSourceJson?.()
    if (dsJson?.url) return dsJson.url
    return null
  }

  const loadUploadLayer = async (): Promise<UploadLayerInfo | null> => {
    const layerUrl = getTargetLayerUrl()
    if (!layerUrl) {
      showMessage('Configure a Feature Layer data source in settings before uploading.', 'warning')
      return null
    }

    const layer = new FeatureLayer({ url: layerUrl })
    await layer.load()

    if (!layer.capabilities?.operations?.supportsAdd) {
      showMessage('Target layer does not support adding new features.', 'warning')
      return null
    }

    return {
      layer,
      supportsAttachments: Boolean((layer as any)?.capabilities?.data?.supportsAttachment)
    }
  }

  const uploadSinglePhoto = async (
    layerInfo: UploadLayerInfo,
    photo: ParsedPhoto
  ): Promise<UploadOutcome> => {
    const { layer, supportsAttachments } = layerInfo
    const graphic = new Graphic({
      geometry: new Point({
        longitude: photo.longitude,
        latitude: photo.latitude,
        spatialReference: { wkid: 4326 }
      }),
      attributes: buildAttributesForPhoto(photo)
    })

    try {
      const editResult = await layer.applyEdits({ addFeatures: [graphic] })
      const featureResult = editResult.addFeatureResults?.[0]

      if (!featureResult || featureResult.error || featureResult.objectId === undefined) {
        return {
          status: 'error',
          issues: appendUniqueIssue(
            photo.issues,
            featureResult?.error?.message || 'Feature upload failed.'
          )
        }
      }

      if (!supportsAttachments) {
        return {
          status: 'warning',
          issues: appendUniqueIssue(photo.issues, 'Layer attachments are not enabled.')
        }
      }

      const formData = new FormData()
      formData.append('attachment', photo.file, photo.file.name)
      const objectIdField = (layer as any)?.objectIdField || 'OBJECTID'
      const featureGraphic = new Graphic({
        attributes: {
          [objectIdField]: featureResult.objectId
        }
      })
      await layer.addAttachment(featureGraphic, formData)

      return {
        status: 'uploaded',
        issues: photo.issues
      }
    } catch (error: any) {
      return {
        status: 'error',
        issues: appendUniqueIssue(photo.issues, error?.message || 'Upload failed.')
      }
    }
  }

  const runUpload = async (photoIds?: string[]) => {
    if (fieldMappings.length === 0) {
      showMessage('Add at least one field mapping in settings before upload.', 'warning')
      return
    }

    const selectedPhotos = photoIds?.length
      ? photos.filter((photo) => photoIds.includes(photo.id))
      : photos

    if (selectedPhotos.length === 0) {
      showMessage('No photos are available for upload.', 'warning')
      return
    }

    if (photoIds?.length === 1 && selectedPhotos[0]?.status === 'uploaded') {
      showMessage('This file is already uploaded and was skipped.', 'info')
      return
    }

    setIsBusy(true)

    try {
      const layerInfo = await loadUploadLayer()
      if (!layerInfo) return

      const updates: PhotoResultById = {}
      const summary: UploadSummary = {
        uploaded: 0,
        warning: 0,
        failed: 0,
        skippedNoGps: 0,
        skippedAlreadyUploaded: 0
      }
      const isSingleRun = Boolean(photoIds?.length)
      const uploadablePhotos: ParsedPhoto[] = []

      for (const photo of selectedPhotos) {
        const isBatchRun = !isSingleRun
        if (isBatchRun && photo.status === 'uploaded') {
          summary.skippedAlreadyUploaded += 1
          continue
        }

        if (photo.latitude === null || photo.longitude === null) {
          summary.skippedNoGps += 1
          updates[photo.id] = {
            status: 'skipped',
            issues: appendUniqueIssue(
              photo.issues,
              'Skipped upload: no GPS metadata was found.'
            )
          }
          continue
        }

        uploadablePhotos.push(photo)
      }

      if (isSingleRun) {
        const photo = uploadablePhotos[0]
        if (photo) {
          const outcome = await uploadSinglePhoto(layerInfo, photo)
          updates[photo.id] = {
            status: outcome.status,
            issues: outcome.issues
          }

          if (outcome.status === 'uploaded') {
            summary.uploaded += 1
          } else if (outcome.status === 'warning') {
            summary.warning += 1
          } else if (outcome.status === 'error') {
            summary.failed += 1
          }
        }
      } else {
        const uploadResults = await Promise.all(
          uploadablePhotos.map(async (photo) => {
            try {
              const outcome = await uploadSinglePhoto(layerInfo, photo)
              return { photo, outcome }
            } catch (error: any) {
              return {
                photo,
                outcome: {
                  status: 'error' as PhotoStatus,
                  issues: appendUniqueIssue(photo.issues, error?.message || 'Upload failed.')
                }
              }
            }
          })
        )

        for (const { photo, outcome } of uploadResults) {
          updates[photo.id] = {
            status: outcome.status,
            issues: outcome.issues
          }

          if (outcome.status === 'uploaded') {
            summary.uploaded += 1
          } else if (outcome.status === 'warning') {
            summary.warning += 1
          } else if (outcome.status === 'error') {
            summary.failed += 1
          }
        }
      }

      setPhotos((current) =>
        current.map((photo) => {
          const update = updates[photo.id]
          if (!update) return photo
          return {
            ...photo,
            status: update.status,
            issues: update.issues
          }
        })
      )

      if (isSingleRun) {
        const first = selectedPhotos[0]
        const outcome = updates[first.id]
        if (!outcome) {
          showMessage('This file was skipped.', 'info')
        } else if (outcome.status === 'uploaded') {
          showMessage(`Uploaded ${first.fileName}.`, 'success')
        } else if (outcome.status === 'warning') {
          showMessage(`Uploaded ${first.fileName} with warnings.`, 'info')
        } else if (outcome.status === 'skipped') {
          showMessage(`Skipped ${first.fileName} due to missing GPS metadata.`, 'info')
        } else {
          showMessage(`Failed to upload ${first.fileName}.`, 'warning')
        }
      } else {
        const hasErrors = summary.failed > 0
        const hasWarningsOrSkips = summary.warning > 0 || summary.skippedNoGps > 0 || summary.skippedAlreadyUploaded > 0

        showMessage(
          `Batch upload complete. Uploaded ${summary.uploaded}${summary.warning > 0 ? `, warnings ${summary.warning}` : ''}${summary.failed > 0 ? `, failed ${summary.failed}` : ''}${summary.skippedNoGps > 0 ? `, skipped no GPS ${summary.skippedNoGps}` : ''}${summary.skippedAlreadyUploaded > 0 ? `, skipped ${summary.skippedAlreadyUploaded}: already uploaded` : ''}.`,
          hasErrors ? 'warning' : (hasWarningsOrSkips ? 'info' : 'success')
        )
      }
    } catch (error: any) {
      console.error(error)
      showMessage(error?.message || 'Upload failed.', 'warning')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Paper
      ref={widgetRootRef}
      className="photo-dump-widget jimu-widget p-2"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <calcite-shell>
        <calcite-panel heading="Photo Dump" className="calcite-panel">
          <calcite-popover
            heading="About Photo Dump"
            label="About Photo Dump"
            autoClose
            referenceElement="details-action"
            placement="bottom"
            overlayPositioning="fixed"
            style={{ '--calcite-popover-max-size-x': '300px' }}
          >
            <p>
              Upload a zip or individual photos, review metadata warnings, optionally adjust exposed
              defaults, preview features on the map,
              then upload one-by-one or in batch.
            </p>
          </calcite-popover>
          <calcite-action
            id="details-action"
            slot="header-actions-start"
            icon="question"
            text=""
          />

          <calcite-tooltip referenceElement="select-files-action" placement="bottom">
            Select files to upload. These can be a zip file containing photos or individual image files.
          </calcite-tooltip>
          <calcite-action
            id="select-files-action"
            text={isNarrowHeader ? '' : 'Select Files'}
            slot="header-actions-end"
            disabled={isBusy || undefined}
            text-enabled={!isNarrowHeader || undefined}
            icon="folder-open"
            onClick={() => {
              fileInputRef.current?.click()
            }}
          />

          <calcite-tooltip referenceElement="preview-action" placement="bottom">
            {isPreviewActive ? 'Clear the map preview.' : 'View photos as points on the map (Without publishing).'}
          </calcite-tooltip>
          <calcite-action
            id="preview-action"
            text={isNarrowHeader ? '' : (isPreviewActive ? 'Clear' : 'View on Map')}
            slot="header-actions-end"
            disabled={isBusy || photos.length === 0 || undefined}
            text-enabled={!isNarrowHeader || undefined}
            icon={isPreviewActive ? 'erase' : 'map'}
            onClick={() => {
              if (isPreviewActive) {
                clearMapPreview()
              } else {
                void showPhotosOnMap()
              }
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,.jpg,.jpeg,.png,.tif,.tiff,.heic,.heif,.webp,.gif,.bmp,image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelectionChange}
          />

          <calcite-notice
            kind="info"
            open={photos.length === 0}
            icon="file-zip"
            scale="s"
          >
            <div slot="title">Upload Photos</div>
            <div slot="message">{INITIAL_PROMPT}</div>
          </calcite-notice>

          {photos.length > 0 && config?.allowUserOverrides && editableMappings.length > 0 && (
            <calcite-block
              iconStart='edit-attributes'
              collapsible
              heading="Edit Feature Template"
              description="Edit these values before submission. Changes will apply to all photos using the same mapping."
            >
              {editableMappings.map((mapping) => (
                <calcite-label key={mapping.id}>
                  {mapping.label || mapping.fieldName}
                  <calcite-input
                    id={`override-${mapping.id}`}
                    type="text"
                    value={userFieldValues[mapping.id] ?? ''}
                    oncalciteInputInput={(evt: any) => {
                      const value = evt?.target?.value ?? ''
                      setUserFieldValues((current) => ({
                        ...current,
                        [mapping.id]: value
                      }))
                    }}
                  ></calcite-input>
                </calcite-label>
              ))}
            </calcite-block>
          )}


          <calcite-block
            iconStart="table"
            heading="Photo Metadata and Status"
            description="Review status of each photo. Hover over status for details on any issues. Optionally, upload photos individually."
            expanded
            collapsible
          >
            <calcite-table
              caption="Photo Metadata and Status Table"
              pageSize={10}
              striped
            >
              <calcite-table-row slot="table-header">
                <calcite-table-header heading="Photo"></calcite-table-header>
                <calcite-table-header heading="Status"></calcite-table-header>
                <calcite-table-header heading="Actions"></calcite-table-header>
              </calcite-table-row>
              {photos.length === 0 && (
                <calcite-table-row>
                  <calcite-table-cell colSpan={4}>No photos loaded yet.</calcite-table-cell>
                </calcite-table-row>
              )}
              {photos.map((photo) => (
                <calcite-table-row key={photo.id}>
                  <calcite-popover
                    referenceElement={`photo-name-cell-${photo.id}`}
                    heading={photo.fileName}
                    label="Some text"
                    placement="top"
                    autoClose
                    style={{ '--calcite-popover-max-size-x': '300px' }}
                  >
                    <p>
                      Photo Timestamp: {photo.timestampIso}<br />
                      Orientation: {photo.orientationLabel ?? photo.orientation ?? 'N/A'}<br />
                      Latitude: {photo.latitude ?? 'N/A'}<br />
                      Longitude: {photo.longitude ?? 'N/A'}
                    </p>
                  </calcite-popover>
                  <calcite-table-cell>
                    <calcite-button
                      id={`photo-name-cell-${photo.id}`}
                      appearance="transparent"
                      scale="s"
                      iconStart="image"
                    />
                    {photo.fileName}
                  </calcite-table-cell>
                  <calcite-table-cell>
                    {photo.status !== 'ready' && photo.status !== 'uploaded' && (
                      <calcite-tooltip
                        referenceElement={`photo-status-${photo.id}`}
                        placement="top"
                      >
                        {photo.issues.length > 0 ? photo.issues.join(' | ') : 'None'}
                      </calcite-tooltip>
                    )}
                    <calcite-chip
                      scale="s"
                      id={`photo-status-${photo.id}`}
                      label={photo.status}
                      appearance="outline"
                      kind="neutral"
                      icon={photo.status === 'ready' ? 'check' : (photo.status === 'uploaded' ? 'check-circle' : 'exclamation-mark-triangle')}
                      style={{
                        '--calcite-chip-border-color': `var(--calcite-color-status-${STATUS_COLORS[photo.status]})`,
                        '--calcite-chip-text-color': `var(--calcite-color-status-${STATUS_COLORS[photo.status]})`,
                        '--calcite-chip-icon-color': `var(--calcite-color-status-${STATUS_COLORS[photo.status]})`
                      }}
                    >
                      {photo.status.charAt(0).toUpperCase() + photo.status.slice(1)}
                    </calcite-chip>
                  </calcite-table-cell>
                  <calcite-table-cell>
                    <calcite-button
                      appearance="outline"
                      scale="s"
                      iconStart="upload"
                      disabled={
                        isBusy ||
                        photo.status === 'uploaded' ||
                        photo.latitude === null ||
                        photo.longitude === null ||
                        undefined
                      }
                      onClick={async () => {
                        await runUpload([photo.id])
                      }}
                    >
                      Upload File
                    </calcite-button>
                  </calcite-table-cell>
                </calcite-table-row>
              ))}
            </calcite-table>
          </calcite-block>

          <calcite-button
            className="photo-dump-batch-upload mt-2 mb-2"
            width="full"
            appearance="solid"
            kind="brand"
            disabled={isBusy || photos.length === 0 || undefined}
            style={{ width: '100%' }}
            onClick={async () => {
              await runUpload()
            }}
          >
            Run Batch Upload
          </calcite-button>

          {props.useMapWidgetIds?.length > 0 && (
            <JimuMapViewComponent
              useMapWidgetId={props.useMapWidgetIds?.[0]}
              onActiveViewChange={(view) => {
                setJimuMapView(view)
              }}
            />
          )}

          {props.useDataSources?.[0] && (
            <DataSourceComponent
              useDataSource={Immutable.from(props.useDataSources[0])}
              query={
                {
                  where: '1=1',
                  outFields: ['*'],
                  returnGeometry: false
                } as FeatureLayerQueryParams
              }
              widgetId={props.id}
              onDataSourceCreated={(ds: DataSource) => {
                setTargetDataSource(ds)
              }}
            />
          )}


          {runtimeAlert && (
            <calcite-alert
              key={runtimeAlert.id}
              kind={runtimeAlert.kind}
              open
              auto-close
              auto-close-duration="medium"
              label="Photo Dump Status"
              oncalciteAlertClose={() => {
                setRuntimeAlert(null)
              }}
            >
              <div slot="message">{runtimeAlert.message}</div>
            </calcite-alert>
          )}

        </calcite-panel>

      </calcite-shell>
    </Paper>
  )
}
