import type { IconResult } from 'jimu-core'

// Defines the structure for a single layer visibility view
export interface ABLSView {
  id: string; //Unique ID for React keys
  name: string;
  icon: IconResult;
  layerIds: string[]; //Array of layer IDs that should be visible
  timeEnabled?: boolean;
  timeRange?: boolean;
  startOffset?: number;
  endOffset?: number;
  tod?: number;
  expandLayerIds?: string[]; //Array of layer IDs that should be shown when expanded
}

// Defines the overall widget configuration
export interface Config {
  expandEnabled?: boolean;
  views: ABLSView[];
}

export type IMConfig = Config
