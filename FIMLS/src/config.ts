import type { ImmutableObject } from 'seamless-immutable'

// Widget configuration
export interface Config {
  id: string // Unique ID for React keys
  layerIds?: string[] // Array of layer IDs that should be visible

  // Individual field keys selected in the settings. Store as a single field name (jimuName).
  // These are optional and can be null if not selected yet.
  toggleBaseUrlField?: string
  toggleItemUrlArrayField?: string
  constantUrlArrayField?: string
  nameField?: string
  minHeightField?: string
  maxHeightField?: string
}

export type IMConfig = ImmutableObject<Config>