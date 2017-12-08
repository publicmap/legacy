/**
 * Handy tools to make your Mapbox GL map cool
 * This is a [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/)
 * @constructor
 * @param {object} options - Options to configure the plugin.
*/

// SETUP
// Datests setup

// 1. Create a new access token with the `datasets:read` and `datasets:write` scope. Request for a beta access if you do not see this option https://www.mapbox.com/api-documentation/#datasets
var mapboxAccessDatasetToken = 'sk.eyJ1IjoidGhlcGxhbmVtYWQiLCJhIjoiY2l3a2Jkazl1MDAwbjJvbXN1MXZzNXJwNyJ9.kNJ9l7CjEfQU4TfWnGpUFw';

// 2. Create a new Mapbox dataset and set the dataset location https://www.mapbox.com/blog/wildfire-datasets/
var dataset = 'citdwsmsa007846o5n1ff2zs9';
var DATASETS_BASE = 'https://api.mapbox.com/datasets/v1/theplanemad/' + dataset + '/';

// DEPENDENCIES
var xtend = require('xtend');
var urlencode = require('urlencode');
var MapboxClient = require('mapbox/lib/services/datasets');
var geojsonCoords = require('geojson-coords');
var mapbox = new MapboxClient(mapboxAccessDatasetToken);
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

  // Add a layer for user annotation on the map
  notes: function(map, options) {

    options = defaultOptions || options;

    map.setStyle(options.styles.hybrid.url);

    map.on('style.load', function(e) {
      init();

      function init() {

        map.addSource('overlayDataSource', {
          type: 'geojson',
          data: {
            "type": "FeatureCollection",
            "features": [
              {
                "type": "Feature",
                "properties": {},
                "geometry": {
                  "type": "Point",
                  "coordinates": [-76.53063297271729, 39.18174077994108]
                }
              }
            ]
          }
        });
        var overlayData = {
          'id': 'overlayData',
          'type': 'circle',
          'source': 'overlayDataSource',
          'interactive': true,
          'layout': {
            visibility: 'visible'
          },
          'paint': {
            'circle-radius': 15,
            'circle-color': 'blue'
          }
        };
        overlayDataSource = map.getSource('overlayDataSource')
        map.addLayer(overlayData);
        getOverlayFeatures();

        map.on('click', function(e) {

          console.log('shoot')

          // Add review marker
          var newOverlayFeature = {
            "type": "Feature",
            "properties": {},
            "geometry": {
              "coordinates": [],
              "type": "Point"
            }
          };

          var clickedOverlayFeatures = map.queryRenderedFeatures([
            [
              e.point.x - 5,
              e.point.y - 5
            ],
            [
              e.point.x + 5,
              e.point.y + 5
            ]
          ], {layers: ['overlayData']});
          if (clickedOverlayFeatures.length) {
            overlayFeatureForm(clickedOverlayFeatures[0]);

          } else {
            overlayFeatureForm();
          }

          function overlayFeatureForm(feature) {
            var formOptions = "<div class='radio-pill pill pad1y clearfix'><input id='safe' type='radio' name='review' value='safe' checked='checked'><label for='safe' class='short button icon check fill-green'>Safe</label><input id='unsafe' type='radio' name='review' value='unsafe'><label for='unsafe' class='short button icon check fill-red'>Danger</label></div>";
            var formReviewer = "<fieldset><label>Reported by: <span id='reviewer' style='padding:5px;background-color:#eee'></span></label><input type='text' name='reviewer' placeholder='name'></input></fieldset>"
            var popupHTML = "<form>" + formOptions + formReviewer + "<a id='updateOverlayFeature' class='button col4' href='#'>Save</a><a id='deleteOverlayFeature' class='button quiet fr col4' href='#' style=''>Delete</a></form>";
            var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHTML).addTo(map);

            // Show existing status if available
            if (feature) {
              $("input[name=review][value=" + feature.properties["key"] + "]").prop('checked', true);
              $("#reviewer").html(feature.properties["contributed_by"]);
              newOverlayFeature = feature;
              newOverlayFeature["id"] = feature.properties["id"];
              console.log(feature);
            } else {
              newOverlayFeature.geometry.coordinates = e.lngLat.toArray();
            }

            // Set reviewer name if previously saved
            if (reviewer) {
              $("input[name=reviewer]").val(reviewer);
            }

            // Update dataset with feature status on clicking save
            document.getElementById("updateOverlayFeature").onclick = function() {
              newOverlayFeature.properties["key"] = $("input[name=review]:checked").val();
              reviewer = $("input[name=reviewer]").val();
              newOverlayFeature.properties["contributed_by"] = reviewer;
              popup.remove();
              mapbox.insertFeature(newOverlayFeature, dataset, function(err, response) {
                console.log(response);
                overlayFeatureCollection.features = overlayFeatureCollection.features.concat(response);
                overlayDataSource.setData(overlayFeatureCollection);
              });
            };
            // Delete feature on clicking delete
            document.getElementById("deleteOverlayFeature").onclick = function() {
              popup.remove();
              mapbox.deleteFeature(newOverlayFeature["id"], dataset, function(err, response) {
                console.log(response);
              });
            };
          }

        });

      }

      // Get data from a Mapbox dataset
      var overlayFeatureCollection = {
        'type': 'FeatureCollection',
        'features': []
      };

      function getOverlayFeatures(startID) {

        var url = DATASETS_BASE + 'features';
        var params = {
          'access_token': mapboxAccessDatasetToken
        };

        // Begin with the last feature of previous request
        if (startID) {
          params.start = startID;
        }

        $.getJSON(url, params, function(data) {

          console.log(data);

          if (data.features.length) {
            data.features.forEach(function(feature) {
              // Add dataset feature id as a property
              feature.properties.id = feature.id;
            });
            overlayFeatureCollection.features = overlayFeatureCollection.features.concat(data.features);
            var lastFeatureID = data.features[data.features.length - 1].id;
            getOverlayFeatures(lastFeatureID);
            overlayDataSource.setData(overlayFeatureCollection);
          }
          overlayDataSource.setData(overlayFeatureCollection);
        });
      }

    });
  },

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
