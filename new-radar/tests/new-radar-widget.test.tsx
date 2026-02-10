import { React, type ImmutableArray } from "jimu-core"
import _Widget from "../src/runtime/widget"
import { widgetRender, wrapWidget } from "jimu-for-test"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"

// Mock Calcite components so they render as simple HTML elements in jsdom
jest.mock("@esri/calcite-components-react", () => {
	const React = require("react")
	const createMock = (displayName: string) => {
		const Component = React.forwardRef((props: any, ref: any) => {
			const { children, ...rest } = props
			return React.createElement(
				"div",
				{ ...rest, ref, "data-testid": displayName },
				children
			)
		})
		Component.displayName = displayName
		return Component
	}
	return {
		CalciteSlider: createMock("CalciteSlider"),
		CalciteButton: createMock("CalciteButton"),
		CalciteSelect: createMock("CalciteSelect"),
		CalciteOption: createMock("CalciteOption"),
		CalciteTooltip: createMock("CalciteTooltip")
	}
})

// Mock WMSLayer since it requires ArcGIS runtime
jest.mock("@arcgis/core/layers/WMSLayer.js", () => {
	return function () {
		return { url: "", sublayers: [], opacity: 1, visible: true }
	}
})

// Mock wms-utils to avoid real network requests
jest.mock("../src/runtime/wms-utils", () => ({
	formatTimestamp: (ts: string, _timeType: boolean) => ts,
	getExtentKey: () => "mock-extent",
	fetchWmsCapabilities: () => Promise.resolve({ times: [] })
}))

// Mock radar-utils to avoid ArcGIS runtime dependencies
jest.mock("../src/runtime/radar-utils", () => ({
	REFRESH_INTERVAL_MS: 240000,
	MAX_FRAMES: 30,
	waitForViewReady: () => Promise.resolve(),
	registerServiceWorker: () => Promise.resolve(),
	prefetchFrames: () => Promise.resolve(),
	refreshTimes: jest.fn(),
	applyFrame: jest.fn(),
	createAnimationControls: () => ({
		start: jest.fn(),
		stop: jest.fn(),
		restart: jest.fn()
	}),
	addFallbackLayer: jest.fn(),
	cleanup: jest.fn()
}))

// Mock the JimuMapViewComponent so the widget receives a jimuMapView during tests
jest.mock("jimu-arcgis", () => {
	const React = require("react")
	return {
		JimuMapViewComponent: ({ onActiveViewChange }: any) => {
			const callbackRef = React.useRef(onActiveViewChange)
			callbackRef.current = onActiveViewChange
			React.useEffect(() => {
				const fakeView = {
					map: {
						allLayers: [
							{ id: "123", visible: true },
							{ id: "456", visible: true },
							{ id: "other", visible: true }
						],
						layers: {
							toArray: () => [],
							findIndex: () => -1
						},
						add: jest.fn()
					},
					timeExtent: null,
					extent: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 },
					width: 800,
					height: 600,
					when: () => Promise.resolve(),
					watch: jest.fn()
				}
				const fakeJmv = {
					view: fakeView,
					whenJimuMapViewLoaded: () => Promise.resolve({ view: fakeView })
				}
				callbackRef.current?.(fakeJmv)
			}, [])
			return React.createElement("div", null, "mock-map")
		}
	}
})

const render = widgetRender()
describe("test ABLS Widget", () => {
	it("configured render", () => {
		const Widget = wrapWidget(_Widget, {
			config: { radarType: "Precipitation" },
			useMapWidgetIds: ["mapWidget_1"] as unknown as ImmutableArray<string>
		})
		render(<Widget widgetId="Widget_1" />)
		expect(screen.getByText("Play Speed").className).toBe("speed-label")
	})

	it("unconfigured render", () => {
		const Widget = wrapWidget(_Widget, {
			config: {}
		})
		render(<Widget widgetId="Widget_1" />)
		expect(
			screen.getByText(
				"Please configure the widget by selecting a radar type and map in the settings."
			)
		).toBeVisible()
	})
})
