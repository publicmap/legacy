/**
 * A [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/) that allows you to
 * query OpenStreetMap data using the Overpass API and visualize it on your Mapbox map.
 * @constructor
 * @param {object} options - Options to configure the plugin.
*/

var queryOverpass = require('query-overpass');
var stripcomments = require('strip-comments');

// TODO: Plugin architecture inspired by https://github.com/mapbox/mapbox-gl-traffic/blob/master/mapbox-gl-traffic.js
// function MapboxOverpass(options) {
//   if (!(this instanceof MapboxOverpass)) {
//     throw new Error('MapboxOverpass needs to be called with the new keyword');
//   }
//
//   this.options = Object.assign({
//     overpassUrl: 'https://overpass-api.de/api/interpreter'
//   }, options);
//
//   this.render = this.render.bind(this);
//
// }

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

    // On pressing enter
    $('#overpass').on('keypress', function(e) {
      if (e.which === 13) {

        var query = $(this).val();
        // Substitue {{bbox}} in query with map bounds
        var bbox = map.getBounds();
        query = query.replace(/{{bbox}}/g, [bbox._sw.lat, bbox._sw.lng, bbox._ne.lat, bbox._ne.lng].join());
        // Strip comments from the query
        // query = stripcomments(query);

        queryOverpass(query, function(e, geojson) {
          map.getSource('overpass').setData(geojson);
        }, {'overpassUrl': 'https://overpass-api.de/api/interpreter'});

      }
    });

  }
}

// Export module
module.exports = Overpass;
