import type { ImmutableObject } from 'seamless-immutable'

export type PhotoFieldSource =
  | 'constant'
  | 'fileName'
  | 'fileCreated'
  | 'photoTimestamp'
  | 'orientation'
  | 'latitude'
  | 'longitude'

export interface PhotoFieldMapping {
  id: string
  fieldName: string
  label?: string
  source: PhotoFieldSource
  constantValue?: string
  exposeToUser?: boolean
}

export interface Config {
  allowUserOverrides: boolean
  fieldMappings: PhotoFieldMapping[]
}

export type IMConfig = ImmutableObject<Config>
