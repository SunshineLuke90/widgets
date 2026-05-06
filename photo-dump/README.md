# Photo Dump

This widget is designed to make the information dump process simple for uploading drone photos into ArcGIS Online via a feature service. The widget allows personnel to upload a zip file, containing geotagged photos (Or a set of individual photos), and after some optional configuration the widget will create a point for each photo, and upload the photo as an attachment for the point. 

## Configuration

The builder can configure the widget to determine the feature defaults, for all field values, including some default values that might exist in the photo's metadata, like file name, photo timestamp, orientation, etc. The builder can also define some default values that will be added for all features, like stamping "Photo" in the feature type field.

All of this can be set in the settings panel, and the settings pane also includes the option to expose some of the settings to the end user after they upload photos, allowing users to adjust the default field values for created features, allowing workflows like allowing the user to describe the location the pictures were taken from, or which team took the photos, etc.

## User Experience

The Widget offers a file upload to the user, and displays a list of photos uploaded, with any errors or issues marked for the user. The user can then view all features on a map (Without actually adding them to the feature service) or decide to actually apply edits, and upload all of the photos and point features.