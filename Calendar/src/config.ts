import type { ImmutableObject } from 'seamless-immutable'
import type { UseDataSource } from 'jimu-core'

export interface colorset {
  id: string;
  fieldValue: string;
  color: string;
}

export interface data {
  id: string // Unique ID for React keys
  useDataSources?: UseDataSource[]

  // Individual field keys selected in the settings. Store as a single field name (jimuName).
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

export interface Config {
  dataSets: data[]
}

export type IMConfig = ImmutableObject<Config>