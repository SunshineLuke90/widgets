import { React, type ImmutableArray } from "jimu-core"
import _Widget from "../src/runtime/widget"
import { widgetRender, wrapWidget } from "jimu-for-test"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import userEvent from "@testing-library/user-event"

// Mock the JimuMapViewComponent so the widget receives a jimuMapView during tests
jest.mock("jimu-arcgis", () => {
	const React = require("react")
	return {
		JimuMapViewComponent: ({ onActiveViewChange }: any) => {
			const callbackRef = React.useRef(onActiveViewChange)
			callbackRef.current = onActiveViewChange
			React.useEffect(() => {
				const fakeJmv = {
					view: {
						map: {
							allLayers: [
								{ id: "123", visible: true },
								{ id: "456", visible: true },
								{ id: "other", visible: true }
							]
						},
						timeExtent: null
					}
				}
				callbackRef.current?.(fakeJmv)
			}, [])
			return React.createElement("div", null, "mock-map")
		}
	}
})

const render = widgetRender()
describe("test ABLS Widget", () => {
	it("basic render", () => {
		//const viewConfig: ABLSView = { id: 'view_1', name: 'View 1', icon: null, layerIds: [], }
		const Widget = wrapWidget(_Widget, {
			config: {
				views: [{ id: "view_1", name: "View 1", icon: null, layerIds: [] }]
			},
			useMapWidgetIds: ["mapWidget_1"] as unknown as ImmutableArray<string>
		})
		const { queryByText } = render(<Widget widgetId="Widget_1" />)
		expect(queryByText("View 1").title).toBe("View 1")
	})

	it("click view button", async () => {
		//const viewConfig: ABLSView = { id: 'view_1', name: 'View 1', icon: null, layerIds: [], }
		const Widget = wrapWidget(_Widget, {
			config: {
				views: [
					{ id: "view_1", name: "View 1", icon: null, layerIds: [] },
					{ id: "view_2", name: "View 2", icon: null, layerIds: ["123", "456"] }
				]
			},
			useMapWidgetIds: ["mapWidget_1"] as unknown as ImmutableArray<string>
		})
		render(<Widget widgetId="Widget_1" />)
		const view2 = screen.getByText("View 2")
		expect(view2).toBeVisible()
		// click the second view and assert it becomes active
		await userEvent.click(view2)
		expect(screen.getByText("View 2").className).toContain("active")
		expect(screen.getByText("View 1").className).not.toContain("active")
	})

	it("not configured", () => {
		const Widget = wrapWidget(_Widget, {
			config: { views: [] },
			useMapWidgetIds: [] as unknown as ImmutableArray<string>
		})
		const { queryByText } = render(<Widget widgetId="Widget_1" />)
		expect(
			queryByText("Please configure this widget in the settings panel.")
		).toBeVisible()
	})
})
