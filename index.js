'use strict';

var mapboxglTools = require('./mapbox-gl-tools');
var mapboxglOverpass = require('./mapbox-gl-overpass');

mapboxgl.accessToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/planemad/cirnjr9do000pgxma53mkgdw0',
  zoom: 11.6,
  center: [
    77.5937, 12.9736
  ],
  hash: true
});

// Initialize a Mapbox GL map using mapboxglTools
mapboxglTools.initmap(map);

// mapboxglTools.addLayerInput(map);

map.on('load', function() {

  // Inspect layer on click and show popup information
  mapboxglTools.inspector(map);
  
  // Add 3D buildings
  mapboxglTools.addLayer(map, {'id': '3d-buildings'});

  // Add a box to query Overpass
  mapboxglOverpass.query(map);

});
