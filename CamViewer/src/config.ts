import type { ImmutableObject } from 'seamless-immutable'
import type { IconResult } from 'jimu-core'

export interface Config {
  icon: IconResult;
}

export type IMConfig = ImmutableObject<Config>
