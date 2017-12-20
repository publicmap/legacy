/**
 * Handy tools to make your Mapbox GL map cool
 * This is a [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/)
 * @constructor
 * @param {object} options - Options to configure the plugin.
*/


// DEPENDENCIES
var xtend = require('xtend');
var urlencode = require('urlencode');
var geojsonCoords = require('geojson-coords');
const MapboxTraffic = require('@mapbox/mapbox-gl-traffic');
const MapboxGeocoder = require('@mapbox/mapbox-gl-geocoder');
const MapboxInspect = require('mapbox-gl-inspect');
const MapboxOverpass = require('mapbox-gl-overpass');

defaultOptions = {
  styles: {
    default: {
      url: "mapbox://styles/planemad/cirnjr9do000pgxma53mkgdw0",
      inspectable: [
        'building',
        'road-label-large',
        'road-label-medium',
        'road-label-small',
        'poi-scalerank4-l1',
        'poi-scalerank4-l15'
      ]
    },
    hybrid: {
      url: "mapbox://styles/planemad/cip0m8hzf0003dhmh432q7g2k"
    }
  }
}

// API

var Tools = {

  // Add a predefined style layer
  addLayer: function(map, options) {

    // Add 3d buildings
    // https://www.mapbox.com/mapbox-gl-js/example/3d-buildings
    if (options.id == '3d-buildings') {
      map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': [
          '==', 'extrude', 'true'
        ],
        'type': 'fill-extrusion',
        'minzoom': 10,
        'paint': {
          'fill-extrusion-color': '#eee',
          'fill-extrusion-height': {
            'type': 'identity',
            'property': 'height'
          },
          'fill-extrusion-base': {
            'type': 'identity',
            'property': 'min_height'
          },
          'fill-extrusion-opacity': .4
        }
      }, 'housenum-label');
    }
  },

  // Add custom layer input
  addLayerInput: function(map, options) {
    // Add an input text box
    $('.mapboxgl-ctrl-top-left').append('<div class="mapboxgl-ctrl-geocoder mapboxgl-ctrl"><input id="custom-layer" type="text" placeholder="Add tile url"></input></div>')
    // On pressing enter
    $('#custom-layer').on('keypress', function(e) {
      if (e.which === 13) {
        var url = $(this).val();
        console.log(url);

        map.addSource('custom-raster-layer', {
          'type': 'raster',
          'tiles': [url],
          'tileSize': 256
        });

        map.addLayer({
          'id': 'custom-raster-layer',
          'type': 'raster',
          'source': 'custom-raster-layer',
          'paint': {}
        }, 'aeroway-taxiway');
      }
    });
  },

  // Init map controls and plugins
  // https://www.mapbox.com/mapbox-gl-js/plugins/
  initmap: function(map, options) {
    map.addControl(new MapboxGeocoder({accessToken: mapboxgl.accessToken}));
    map.addControl(new mapboxgl.ScaleControl());
    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      }
    }));
    map.addControl(new MapboxTraffic());
    map.addControl(new MapboxInspect({
      popup: new mapboxgl.Popup({closeButton: false, closeOnClick: false})
    }));
    map.addControl(new MapboxOverpass());
  }

}

// Genreate HTML content for the inspector view
function populateTable(feature) {

  // Populate the popup and set its coordinates
  // based on the feature found.

  try {
    var coordinates = geojsonCoords(feature);
  } catch (e) {
    console.log(e);
    coordinates = [];
  }

  var popupHTML = "<h3>" + feature.properties.name + "</h3>";

  // Show nominatim link if feature has a name
  if (feature.properties.name != undefined) 
    popupHTML += "<a href='" + nominatimLink(feature.properties.name, coordinates[0]) + "'>OSM Search</a><br>";
  
  popupHTML += "<table style='table-layout:fixed'>";

  for (property in feature.properties) {
    if (property == 'distance') {
      var distance = feature.properties[property];
      popupHTML += "<tr bgcolor = #d5e8ce><td>" + property + "</td><td>" + parseFloat(distance.toFixed(3)) + "</td></tr>";
    } else {
      popupHTML += "<tr><td>" + property + "</td><td>" + feature.properties[property] + "</td></tr>";
    }
  }
  popupHTML += "</table>";

  return popupHTML;
}

// Generate a nominatim search link for a feature name
function nominatimLink(name, coordinates) {

  const NOMINATIM_BASE = 'http://nominatim.openstreetmap.org/search.php?q=';

  // Limit search to the vicinity of the given coordinates
  try {

    var left = coordinates[0] - 1;
    var top = coordinates[1] - 1;
    var right = coordinates[0] + 1;
    var bottom = coordinates[1] + 1;

    var NOMINATIM_options = name + "&polygon=1&bounded=1&viewbox=" + left + "%2C" + top + "%2C" + right + "%2C" + bottom

  } catch (e) {
    var NOMINATIM_options = urlencode(name);
  }

  return NOMINATIM_BASE + NOMINATIM_options;

}

// Geometry functions

// Return a square bbox of pixel coordinates from a given x,y point
function pixelPointToSquare(point, width) {
  var pointToSquare = [
    [
      point.x - width / 2,
      point.y - width / 2
    ],
    [
      point.x + width / 2,
      point.y + width / 2
    ]
  ];
  return pointToSquare;
}

// Export module
module.exports = Tools;
