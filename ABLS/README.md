# A Better Layer Switcher (ABLS)

This custom widget provides a simple tool to be able to create custom views of data, which can be easily switched between using a "views navigation like" experience, with significantly less load time.

"Views" can be created on a given map, effectively creating separate sets of layers that will be visible when an input button is clicked. This will not break any existing "map layers" widgets, or any filtering / timeline widgets that are already in place to filter data, it simply provides a more intuitive experience for users to toggle between sets of layers within a map based experience.

## Using the widget

Implementation is simple. Just drag the widget into your application, connect it to a map if it doesn't automatically connect, then create a view and select all of the layers you want visible (Including basemap layers). The layer order will be maintained, it's just the visibility that will be changed. The first view that you choose will be what the map will appear with the first time the ABLS widget is loaded.

If the data you are switching views between is time enabled, you can also apply time filtering on the view. Time filtering is relatively self explanatory, but in general, is used to apply dynamic time filtering as an offfset from the current time. This is good for forecast maps, or to view past information, like in an EOC setting. If your layers are not time enabled, do not turn on time filtering to speed up load time.
