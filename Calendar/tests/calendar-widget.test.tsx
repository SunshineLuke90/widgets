import { React, type UseDataSource, type ImmutableArray, IMDataSourceJson, DataSourceTypes } from "jimu-core"
import _Widget from "../src/runtime/widget"
import { mockFeatureLayer, widgetRender, wrapWidget } from "jimu-for-test"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { featureLayer } from "./feature-service"

// Mock the DataSource so the widget receives a data source during tests
jest.mock("jimu-core", () => {
	return {
		...jest.requireActual("jimu-core"),
		DataSourceComponent: ({ onDataSourceCreated }: any) => {
			React.useEffect(() => {
				const fakeDs = () => {
					mockFeatureLayer(featureLayer)
				}
				onDataSourceCreated && onDataSourceCreated(fakeDs)
			}, [onDataSourceCreated])
			return React.createElement("div", null, "mock-datasource")
		}
	}
})

const setupMockDataSource = (dsId: string) => {
	const fakeDs = mockFeatureLayer(featureLayer)

	// 2. Define the data source configuration
  const dsJson: IMDataSourceJson = {
    id: dsId, // This is where you set the desired ID for testing
    type: DataSourceTypes.FeatureLayer,
    label: "Test Layer",
    originDataSources: [],
		data: fakeDs,
    // ... other schema details
  };




const render = widgetRender()
describe("test Calendar Widget", () => {
	it("handle unconfigured settings panel", () => {
		const Widget = wrapWidget(_Widget, {
			config: {}
		})
		const { queryByText, rerender } = render(<Widget widgetId="Widget_1" />)
		expect(
			queryByText("Please configure the Calendar widget in the settings panel.")
		).toBeTruthy()

		rerender(
			<Widget
				widgetId="Widget_1"
				config={{}}
				useDataSources={
					[
						{
							dataSourceId: "mock-datasource",
							mainDataSourceId: "mock-datasource"
						}
					] as unknown as ImmutableArray<any>
				}
			/>
		)
		expect(
			queryByText("Please configure the Calendar widget in the settings panel.")
		).toBeTruthy()
		expect(queryByText("Month", { selector: "button" })).toBeFalsy()

		rerender(
			<Widget
				widgetId="Widget_1"
				config={{
					labelField: "name",
					startDateField: "start_date",
					endDateField: "end_date",
					allDayField: "all_day"
				}}
			/>
		)
		expect(
			queryByText("Please configure the Calendar widget in the settings panel.")
		).toBeTruthy()
	})

	it("basic render with configured settings", async () => {
		const Widget = wrapWidget(_Widget, {
			config: {
				labelField: "label",
				startDateField: "start_date",
				endDateField: "end_date",
				allDayField: "all_day"
			},
			useDataSources: [
				{
					dataSourceId: "mock-datasource",
					mainDataSourceId: "mock-datasource"
				}
			] as unknown as ImmutableArray<UseDataSource>
		})
		render(<Widget widgetId="Widget_1" />)
		expect(screen.queryByText("mock-datasource")).toBeTruthy()
		expect(screen.queryAllByText("Month", { selector: "button" })).toBeTruthy()
		const event = await screen.findByText("Event 1", {
			selector: ".fc-event-title"
		})
		expect(event).toBeTruthy()
	})
})
