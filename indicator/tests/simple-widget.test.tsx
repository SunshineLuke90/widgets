import { React } from "jimu-core"
import _Widget from "../src/runtime/widget"
import { widgetRender, wrapWidget } from "jimu-for-test"

const render = widgetRender()
describe("test indicator widget renders", () => {
	it("renders without crashing with minimal config", () => {
		const Widget = wrapWidget(_Widget, {
			config: {
				topText: "",
				middleText: "",
				bottomText: "",
				topTextColor: "#000",
				topTextMaxSize: "medium",
				middleTextColor: "#000",
				middleTextMaxSize: "xx-large",
				bottomTextColor: "#000",
				bottomTextMaxSize: "medium",
				indType: "Statistic",
				mainStatisticType: "count",
				indField: "",
				refType: "none",
				refStatisticType: "count",
				valueStyle: "Decimal",
				valueDigitGrouping: false,
				valueUnitPrefix: false,
				valuePrefix: "",
				valueSuffix: "",
				pctDigitGrouping: false,
				pctPrefix: "",
				pctSuffix: "",
				ratioDigitGrouping: false,
				ratioPrefix: "",
				ratioSuffix: "",
				showLastUpdateTime: false,
				lastUpdateTimeTextColor: "#000",
				infoText: ""
			}
		})
		// Should render without throwing
		const { container } = render(<Widget widgetId="Widget_1" />)
		expect(container).toBeTruthy()
	})
})
