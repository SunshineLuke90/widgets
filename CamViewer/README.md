# CamViewer Widget

This is a simple widget to view .m3u8 streams using a url field in a feature layer. The widget appears as a button, which when clicked will turn on the "camera" layer, and when a camera is clicked a popup video stream will appear to start streaming the live camera feed.

## Setting up the widget

This widget can be set up by adding the widget to your application, then selecting the map and data source the camera layer is stored in. You will then select the field that the .m3u8 url is stored in, as well as an icon for the main widget button. It is recommended that you set a background color in the style settings, and also set the height and width to "auto".

## Using the widget

Click the widget button (Icon selected by builder), and cameras should appear on your map. Click a camera icon on your map, and a viewing window should appear. You can then click the X icon in the top right of the camera window to close the camera feed and unselect the camera feature/features.
