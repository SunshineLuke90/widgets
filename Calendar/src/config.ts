import type { ImmutableObject } from 'seamless-immutable'
import type { IconResult } from 'jimu-core';

export interface Config {
  id: string // Unique ID for React keys

  // Individual field keys selected in the settings. Store as a single field name (jimuName).
  // These are optional and can be null if not selected yet.
  labelField?: string
  startDateField?: string
  endDateField?: string
  allDayField?: string
  descriptionField?: string
}

export type IMConfig = ImmutableObject<Config>
