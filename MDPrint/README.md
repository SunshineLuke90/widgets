# Markdown Print Widget

This widget uses the simplicity of the Markdown language, combined with a simple parser, to create a wicked fast feature report generation tool. The markdown print widget allows the GIS builder to create a feature report using similar syntax to the Survey123 Feature Report syntax, providing a recognizable user experience when developing your feature reports. Some of the more complex features of Esri's Feature Reports have not been replicated (Like conditional formatting and map embeds). However, what you may lose in the way of "nice to have" features of feature reports, you gain in printing speed, reliability, and end-user modification.

## User Experience

This widget aims to make the user experience as simple as possible. The builder will configure potentially multiple templates, which the end user can choose from. When the user selects a feature (Or multiple features), the print button will become active, and an indicator will appear with the number of features selected for that template. By default, the template editor is hidden, but if the user is advanced, and wants to edit the way the template would be generated, they can open the template markdown or css and edit it in their own session.

When prints are made, there are no service calls, no downtime, just reliable markdown to html formatting, printing directly in browser. No server is receiving your print job, and the only service that is needed is for the data to load into your application for you to select. This means speed, and reliability, which is paramount for workflows like a check-in process, large document generation for mailing, record generation for government documentation requirements, etc.

## Builder Experience

The builder shouldn't have a difficult time formatting this widget. Since Markdown is used, it simplifies the formatting requirements, meaning that you don't have to fiddle around with a table in word, or ensure that all of your text is properly slammed together. Markdown also supports html tags, so things like images can still be embedded into the generated reports, meaning logos can be used! Since CSS is also used for the formatting, the sky is the limit in terms of the styling that is desired. Using other sites, like [https://markdowntohtml.com/](https://markdowntohtml.com/), you can quickly see results for generating your markdown and css templates. If you're looking for css inspiration (Or just want something to start with), I highly recommend checking out Jason M's GitHub collection of a few css stylesheets that is publicly available, along with a quick [visualizer](https://jasonm23.github.io/markdown-css-themes/) of the themes in action.

### Using Feature Information

Feature information can be integrated into the print through a few different formatting elements, described below:

- `${ fieldName }` : By simply wrapping a fieldname for the selected feature in ${}, that field value will be inserted into the markdown before printing.
- `${dateField | "MM/dd/YY h:mm A"}` : This formats a date field, using the following format matching characters:
  - MMMMM: Converts to long month (ex. January),
  - MMM: Converts to abbreviated month (ex. Jan),
  - MM: Two digit padded month (ex. 01),
  - M: Month as digit, no padding (ex. 1),
  - DDDD: Day of the week, long (ex. Monday),
  - DDD: Day of the week, abbreviated (ex. Mon),
  - DD: Two digit padded day of month (ex. 05),
  - D: Day of the month, no padding (ex. 5),
  - YYYY: Full year (ex. 2026),
  - YY: Two digit year (ex. 26),
  - hh: Two digit padded hours, civilian time (ex. 07),
  - h: Civilian time hour (ex. 7),
  - HH: Two digit padded Military time (ex. 19),
  - H: Non padded Military time (ex. 7),
  - mm: Two digit padded minutes (ex. 38),
  - ss: Two digit padded seconds (ex. 38),
  - A: AM or PM

- `${numField | '#,###.00'}` : This formats a numeric field, using the following format options:
  - "#,###.00" returns a string formatted 1,234,567.89
  - "0.00" returns a string formatted 1234.50
  - "0.0" returns a string formatted 1234.6

### Query Function

On top of being able to show an individual feature's information, if you have related tables, or want to provide information based on a query, to a separate feature service, that can be achieved using the query parameter. Formatting tips are below:

Example:

```
| Name | Address | Income |
| ---- | ------- | ------ |
${Query | <Feature Service URL> | ParentID = ${GLOBALID}}| ${name} | ${Address} | ${Income} |
${/Query}
```

So how does that work? First, the first 2 lines are simply setting up the table using markdown formatting, where the rest of the information will go. The third line is split into 3 parts:

- `${Query | <Feature Service URL> | ParentID = ${GLOBALID}}` This initializes the query, with the service url to be queried, and the where clause to be used.
  - `Query`: This is just a label to note to the parser that a query is coming up.
  - `<Feature Service URL>` This is what it sounds like. You need to use the full feature service url, which includes the layer id.
  - `ParentID = ${GLOBALID}` This is an example query, which when read would read as "Give me all child features that have a ParentID equal to this features GlobalID".
- `| ${name} | ${Address} | ${Income} |` This is what will be repeated for all features that are returned by the query. In this case, we continue the markdown table formatting, and we add a newline directly after the query, to ensure each line of markdown is placed on a next line. -`${/Query}` This is the final tag of the query, signaling to the parser that it should return to replacing placeholders with the original feature's values.

_Note: When performing a query on a date field, like when you want to return all features that are between two dates, or return all features that are after a given date, you need to format the querying date field, using something like this:_

```
${Query | <URL> | Date > '${dateField | 'MM/dd/yy'}'}
```

## Credits

This widget would not be possible without a few external libraries.

- marked: Used for converting markdown into HTML. This library is doing the bulk of the work.
- DOMPurify: Used for taking the html generated by marked, and cleaning it up, preventing someone from injecting malicious code into a feature service, which could be exploited when a print is made on it.
- print-js: Used for taking the generated HTML, and opening a print dialog with a well formatted document, all in-browser.

These external libraries power ~50% of the functionality of this widget. The user interface, and builder capabilities are done through Jimu-ui, and Calcite Components, and the parsing functionality to convert feature service data into the feature report is where the bulk of the effort actually put into this widget went.
