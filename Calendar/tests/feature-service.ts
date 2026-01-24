import type { MockFeatureLayerData } from "jimu-for-test"

const FEATURE_LAYER_URL = 'https://services3.arcgis.com/SMmkLJuWWI7vDDUq/arcgis/rest/services/Events/FeatureServer/0'

const NOW = new Date(Date.now()).toISOString()
const LATER = new Date(Date.now() + 60*60*1000).toISOString()

const SERVER_INFO = {
  currentVersion: 10.71,
  fullVersion: '10.7.1',
  soapUrl: 'https://sunshinegis.maps.arcgis.com/arcgis/services',
  secureSoapUrl: 'https://sunshinegis.maps.arcgis.com/arcgis/services',
  authInfo: {
    isTokenBasedSecurity: true,
    tokenServicesUrl: 'https://sunshinegis.maps.arcgis.com/arcgis/tokens/',
    shortLivedTokenValidity: 60
  }
}

/**
 * Mocked point feature layer.
 */
export const featureLayer: MockFeatureLayerData = {
  url: FEATURE_LAYER_URL,
  serverInfo: SERVER_INFO,
  layerDefinition: {
    currentVersion: 10.71,
    id: 0,
    name: 'Incidents',
    type: 'Feature Layer',
    geometryType: 'esriGeometryPoint',
    objectIdField: 'objectid',
    globalIdField: '',
    displayField: 'req_type',
    typeIdField: 'req_type',
    subtypeField: '',
    fields: [
      {
        name: 'objectid',
        type: 'esriFieldTypeOID',
        alias: 'Object ID',
        domain: null,
        editable: false,
        nullable: false,
        defaultValue: null,
        modelName: 'OBJECTID'
      },
      {
        name: 'label',
        type: 'esriFieldTypeString',
        alias: 'Label',
        domain: null,
        editable: false,
        nullable: false,
        defaultValue: null,
        modelName: 'LABEL'
      },
      {
        name: 'start_date',
        type: 'esriFieldTypeDate',
        alias: 'Start Date',
        domain: null,
        editable: false,
        nullable: false,
        defaultValue: null,
        modelName: 'START_DATE'
      },
      {
        name: 'end_date',
        type: 'esriFieldTypeDate',
        alias: 'End Date',
        domain: null,
        editable: false,
        nullable: false,
        defaultValue: null,
        modelName: 'END_DATE'
      },
      {
        name: 'all_day',
        type: 'esriFieldTypeString',
        alias: 'All Day',
        domain: null,
        editable: false,
        nullable: true,
        defaultValue: null,
        modelName: 'ALL_DAY'
      },
      {
        name: 'description',
        type: 'esriFieldTypeString',
        alias: 'Description',
        domain: null,
        editable: false,
        nullable: true,
        defaultValue: null,
        modelName: 'DESCRIPTION'
      },
      {
        name: 'color',
        type: 'esriFieldTypeString',
        alias: 'Color',
        domain: null,
        editable: false,
        nullable: true,
        defaultValue: null,
        modelName: 'COLOR'
      },
      {
        name: 'geometryField',
        type: 'esriFieldTypeGeometry'
      }
    ],
    advancedQueryCapabilities: {
      useStandardizedQueries: true,
      supportsStatistics: true,
      supportsHavingClause: true,
      supportsOrderBy: true,
      supportsDistinct: true,
      supportsCountDistinct: true,
      supportsPagination: true,
      supportsPaginationOnAggregatedQueries: true,
      supportsTrueCurve: true,
      supportsReturningQueryExtent: true,
      supportsQueryWithDistance: true,
      supportsSqlExpression: true
    }
  },
  queries: [{
    url: `${FEATURE_LAYER_URL}/query?f=json&where=1=1&outFields=*`,
    result: {
      fields: [{
        name: 'objectid',
        type: 'esriFieldTypeOID',
        alias: 'Object ID'
      },{
        name: 'label',
        type: 'esriFieldTypeString',
        alias: 'Label'
      },{
        name: 'start_date',
        type: 'esriFieldTypeDate',
        alias: 'Start Date'
      },{
        name: 'end_date',
        type: 'esriFieldTypeDate',
        alias: 'End Date'
      },{
        name: 'all_day',
        type: 'esriFieldTypeString',
        alias: 'All Day'
      },{
        name: 'description',
        type: 'esriFieldTypeString',
        alias: 'Description'
      },{
        name: 'color',
        type: 'esriFieldTypeString',
        alias: 'Color'
      }],
      features: [{
        attributes: {
          objectid: 1,
          label: 'Event 1',
          start_date: NOW,
          all_day: 'y',
          description: 'Description for Event 1',
          color: 'High'
        }},{
        attributes: {
          objectid: 2,
          label: 'Event 2',
          start_date: NOW,
          end_date: LATER,
          all_day: 'n',
          description: 'Description for Event 2',
          color: 'Medium'
        }},{attributes: {
          objectid: 3,
          label: 'Event 3',
          start_date: 1622764800000,
          all_day: 'y',
          description: 'Description for Event 3',
          color: 'Low'
        }}
      ]
    }
  }]
} as MockFeatureLayerData