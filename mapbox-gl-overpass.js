/**
 * A [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/) that allows you to
 * query OpenStreetMap data using the Overpass API and visualize it on your Mapbox map.
 * @constructor
 * @param {object} options - Options to configure the plugin.
*/

var queryOverpass = require('query-overpass');
// var stripcomments = require('strip-comments');

// For future: Architect the plugin like https : github.com/mapbox/mapbox-gl-traffic/blob/master/mapbox-gl-traffic.js
function MapboxOverpass(options) {
  if (!(this instanceof MapboxOverpass)) {
    throw new Error('MapboxOverpass needs to be called with the new keyword');
  }

  this.options = Object.assign({
    enabled: false,
    showOverpassButton: true,
    overpassUrl: 'http://overpass-api.de/api/interpreter'
  }, options);

  this.render = this.render.bind(this);
  this.toggle = this.toggle.bind(this);
  this._hide = this._hide.bind(this);
  this._show = this._show.bind(this);
  this._toggle = new ToogleButton({show: this.options.showOverpassButton, onToggle: this.toggle.bind(this)});
}

/**
 * Toggle visibility of overpass layer.
 */
MapboxOverpass.prototype.toggleTraffic = function() {
  this.options.showToggle = !this.options.showToggle;
  this.render();
};

//
var inputQuery;
var Overpass = {

  // Inspect map layers on mouse interactivity
  query: function(map, options) {

    // Add an input text box
    $('.mapboxgl-ctrl-top-left').append('<div class="mapboxgl-ctrl"><input id="overpass" type="text" placeholder="Overpass QL"></input></div>')

    // Add a geojson source and style layers
    // Data layer
    map.addSource('overpass', {
      type: 'geojson',
      data: {
        "type": "FeatureCollection",
        "features": []
      }
    });
    // Fill
    map.addLayer({
      'id': 'overpass fill',
      'type': 'fill',
      'source': 'overpass',
      'paint': {
        'fill-color': '#ff00ed',
        'fill-opacity': 0.2
      },
      'filter': ["==", "$type", "Polygon"]
    }, 'aeroway-taxiway');
    // Lines
    map.addLayer({
      'id': 'overpass line',
      'type': 'line',
      'source': 'overpass',
      'paint': {
        'line-color': '#ff00ed',
        'line-width': 20,
        'line-opacity': 0.5
      }
    }, 'aeroway-taxiway');
    // Points
    map.addLayer({
      'id': 'overpass points',
      'type': 'circle',
      'source': 'overpass',
      'paint': {
        'circle-color': '#ff00ed',
        'circle-radius': 10,
        'circle-opacity': 0.5
      }
    }, 'aeroway-taxiway');

    // Update map on pressing enter
    $('#overpass').on('keypress', function(e) {
      if (e.which === 13) {

        inputQuery = $(this).val();
        updateMap(map);

      }
    });

    // Update map on move
    map.on('moveend', function(e) {
      updateMap(map);
    })

  }
}

// Render the overpass results
function updateMap(map) {
  var bbox = map.getBounds();
  query = inputQuery.replace(/{{bbox}}/g, [bbox._sw.lat, bbox._sw.lng, bbox._ne.lat, bbox._ne.lng].join());

  queryOverpass(query, function(e, geojson) {
    console.log(geojson);
    map.getSource('overpass').setData(geojson);

  });
}

// Export module
module.exports = Overpass;
