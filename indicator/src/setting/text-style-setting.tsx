import { React } from "jimu-core"
import { SettingRow } from "jimu-ui/advanced/setting-components"
import {
	TextInput,
	Dropdown,
	DropdownButton,
	DropdownMenu,
	DropdownItem
} from "jimu-ui"
import { ColorPicker } from "jimu-ui/basic/color-picker"
import type { FontSize, IMConfig } from "../config"

const expressionItemStyle: React.CSSProperties = {
	flexDirection: "column",
	display: "flex",
	alignItems: "flex-start",
	textAlign: "left"
}

const FONT_SIZES: FontSize[] = [
	"xx-small",
	"x-small",
	"small",
	"medium",
	"large",
	"x-large",
	"xx-large"
]

const EXPRESSIONS = [
	{ label: "Value", value: "{calculated/value}" },
	{ label: "Reference", value: "{calculated/reference}" },
	{ label: "Difference", value: "{calculated/difference}" },
	{ label: "Absolute difference", value: "{calculated/absoluteDifference}" },
	{ label: "Percentage", value: "{calculated/percentage}" },
	{ label: "Percent Change", value: "{calculated/percentChange}" },
	{ label: "Ratio", value: "{calculated/ratio}" },
	{ label: "Ratio change", value: "{calculated/ratioChange}" }
]

type TextStylePrefix = "top" | "middle" | "bottom"
type TextStyleSuffix = "" | "Below"

interface TextStyleSettingProps {
	prefix: TextStylePrefix
	suffix?: TextStyleSuffix
	label: string
	config: IMConfig
	onChange: (patch: Partial<IMConfig>) => void
	intl: any
}

export default function TextStyleSetting({
	prefix,
	suffix = "",
	label,
	config,
	onChange,
	intl
}: TextStyleSettingProps) {
	const keys = {
		text: `${prefix}Text${suffix}` as keyof IMConfig,
		color: `${prefix}TextColor${suffix}` as keyof IMConfig,
		maxSize: `${prefix}TextMaxSize${suffix}` as keyof IMConfig
	}

	const text = config[keys.text] as string
	const color = config[keys.color] as string
	const fontSize = config[keys.maxSize] as FontSize
	return (
		<>
			<SettingRow label={label} flow={"wrap"}>
				<Dropdown
					id={`${prefix}-expression-insert-dropdown`}
					direction="down"
					menuRole="menu"
					activeIcon
				>
					<DropdownButton>{"{}"}</DropdownButton>
					<DropdownMenu>
						{EXPRESSIONS.map((expression) => (
							<DropdownItem
								key={expression.value}
								style={expressionItemStyle}
								onClick={() => {
									onChange({ [keys.text]: text + expression.value } as any)
								}}
							>
								<strong>{expression.label}</strong>
								{expression.value}
							</DropdownItem>
						))}
					</DropdownMenu>
				</Dropdown>
				<TextInput
					value={text}
					onChange={(e) => {
						onChange({ [keys.text]: e.target.value } as any)
					}}
				/>
			</SettingRow>
			<SettingRow>
				<ColorPicker
					color={color}
					onChange={(c) => {
						onChange({ [keys.color]: c } as any)
					}}
				/>
				<div style={{ width: "8px" }}></div>
				<Dropdown
					id={`${prefix}TextSize`}
					direction="down"
					menuItemCheckMode="default"
					menuRole="menu"
					size="sm"
					activeIcon
				>
					<DropdownButton>ᴀA</DropdownButton>
					<DropdownMenu>
						{FONT_SIZES.map((size) => (
							<DropdownItem
								key={size}
								active={fontSize === size}
								onClick={() => {
									onChange({ [keys.maxSize]: size } as any)
								}}
							>
								{size}
							</DropdownItem>
						))}
					</DropdownMenu>
				</Dropdown>
			</SettingRow>
		</>
	)
}
