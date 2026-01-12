import type { ImmutableObject } from 'seamless-immutable'

export interface colorset {
  id: string;
  fieldValue: string;
  color: string;
}

export interface Config {
  id: string // Unique ID for React keys

  // Individual field keys selected in the settings. Store as a single field name (jimuName).
  // These are optional and can be null if not selected yet.
  labelField?: string
  startDateField?: string
  endDateField?: string
  allDayField?: string
  descriptionField?: string
  colorsetField?: string

  // Color settings
  defaultEventColor?: string
  colorsets?: colorset[]
}

export type IMConfig = ImmutableObject<Config>