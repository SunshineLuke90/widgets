import { React } from "jimu-core"
import { SettingRow } from "jimu-ui/advanced/setting-components"
import { Switch, NumericInput, TextInput } from "jimu-ui"
import type { IMConfig } from "../config"

type NumberFormatPrefix = "value" | "pct" | "ratio"

interface NumberFormatSettingProps {
	prefix: NumberFormatPrefix
	config: IMConfig
	onChange: (patch: Partial<IMConfig>) => void
	intl: any
}

export default function NumberFormatSetting ({
	prefix,
	config,
	onChange,
	intl
}: NumberFormatSettingProps) {
	const keys = {
		digitGrouping: `${prefix}DigitGrouping` as keyof IMConfig,
		minDecimal: `${prefix}MinDecimalPlaces` as keyof IMConfig,
		maxDecimal: `${prefix}MaxDecimalPlaces` as keyof IMConfig,
		prefix: `${prefix}Prefix` as keyof IMConfig,
		suffix: `${prefix}Suffix` as keyof IMConfig
	}

	return (
		<>
			<SettingRow
				label={intl.formatMessage({
					id: "groupingToggle",
					defaultMessage: "Digit Grouping"
				})}
			>
				<Switch
					checked={config[keys.digitGrouping] as boolean}
					onChange={() => {
						onChange({
							[keys.digitGrouping]: !config[keys.digitGrouping]
						} as any)
					}}
				/>
			</SettingRow>
			<SettingRow
				label={intl.formatMessage({
					id: "minDecimalPlaces",
					defaultMessage: "Minimum Decimal Places"
				})}
				flow="wrap"
			>
				<NumericInput
					value={config[keys.minDecimal] as number}
					precision={0}
					onChange={(v) => {
						onChange({ [keys.minDecimal]: v } as any)
					}}
				/>
			</SettingRow>
			<SettingRow
				label={intl.formatMessage({
					id: "maxDecimalPlaces",
					defaultMessage: "Maximum Decimal Places"
				})}
				flow="wrap"
			>
				<NumericInput
					value={config[keys.maxDecimal] as number}
					precision={0}
					onChange={(v) => {
						onChange({ [keys.maxDecimal]: v } as any)
					}}
				/>
			</SettingRow>
			<SettingRow
				label={intl.formatMessage({
					id: "prefixSuffix",
					defaultMessage: "Prefix/Suffix"
				})}
				flow="wrap"
			>
				<TextInput
					placeholder={intl.formatMessage({
						id: "prefixPlaceholder",
						defaultMessage: "Prefix"
					})}
					value={config[keys.prefix] as string}
					onChange={(e) => {
						onChange({ [keys.prefix]: e.target.value } as any)
					}}
				/>
				<TextInput
					style={{ marginTop: "8px" }}
					placeholder={intl.formatMessage({
						id: "suffixPlaceholder",
						defaultMessage: "Suffix"
					})}
					value={config[keys.suffix] as string}
					onChange={(e) => {
						onChange({ [keys.suffix]: e.target.value } as any)
					}}
				/>
			</SettingRow>
		</>
	)
}
