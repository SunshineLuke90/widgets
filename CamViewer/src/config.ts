import type { ImmutableObject } from 'seamless-immutable'
import type { IconResult } from 'jimu-core'

export interface Config {
  icon: IconResult;
  multiple: boolean;
}

export type IMConfig = ImmutableObject<Config>
