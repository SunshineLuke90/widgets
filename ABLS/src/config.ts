import type { IconResult } from 'jimu-core'

// Defines the structure for a single layer visibility view
export interface ABLSView {
  id: string; //Unique ID for React keys
  name: string;
  icon: IconResult;
  layerIds: string[]; //Array of layer IDs that should be visible
  timeEnabled?: boolean;
  startOffset?: number;
  endOffset?: number
}

// Defines the overall widget configuration
export interface Config{
  views: ABLSView[];
}

export type IMConfig = Config
