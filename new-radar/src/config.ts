import type { ImmutableObject } from 'seamless-immutable'

export interface Config {
  radarType: string,
  placementLayer?: string,
}

export type IMConfig = ImmutableObject<Config>
