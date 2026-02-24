import type { UseDataSource } from "jimu-core"
import type { ImmutableObject } from "seamless-immutable"

export interface PrintTemplate {
	id: string
	label: string
	markdown: string
	css: string
	useDataSources?: UseDataSource[]
}

export interface Config {
	PrintTemplates: PrintTemplate[]
}

export type IMConfig = ImmutableObject<Config>
